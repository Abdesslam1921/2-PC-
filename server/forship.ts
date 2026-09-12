import {
  computeShipmentUpdate,
  parseWebhookPayload,
  UNKNOWN_MAPPING,
  verifyWebhookSignature,
} from "./forshipCore";
import {
  applyShipmentStatus,
  getCarrierById,
  getCarrierStatusMapping,
  getMerchantCarrierCredential,
  getShipmentByTracking,
  listDueShipments,
  listShipmentsByOrder,
  listStaleWebhookShipments,
  setWebhookRegistered,
  switchShipmentToPolling,
  type ApplyShipmentResult,
} from "./forshipDb";
import { getEcotrackTrackingInfo, type EcotrackCredentials } from "./ecotrack";
import type { Carrier, OrderShipment } from "../drizzle/schema";

export type CarrierCredentials = { baseUrl: string; token: string };

export type CarrierAdapter = {
  getStatus(
    trackingNumber: string,
    credentials: CarrierCredentials
  ): Promise<{ rawLabel: string | null }>;
};

const ecotrackAdapter: CarrierAdapter = {
  async getStatus(trackingNumber, credentials) {
    const info = await getEcotrackTrackingInfo(
      credentials as EcotrackCredentials,
      trackingNumber
    );
    return { rawLabel: info.status ?? null };
  },
};

/**
 * Best-effort generic adapter for carriers without a dedicated integration yet
 * (yalidine / custom). Performs a GET against `{baseUrl}/tracking/{tracking}`
 * and extracts a raw label using the same tolerant rules as the webhook parser.
 */
const genericAdapter: CarrierAdapter = {
  async getStatus(trackingNumber, credentials) {
    const url = `${credentials.baseUrl.replace(/\/+$/, "")}/tracking/${encodeURIComponent(trackingNumber)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Carrier HTTP ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    const parsed = parseWebhookPayload(payload);
    return { rawLabel: parsed?.rawLabel ?? null };
  },
};

export function resolveAdapter(
  carrier: Pick<Carrier, "platformType">
): CarrierAdapter {
  return carrier.platformType === "ecotrack" ? ecotrackAdapter : genericAdapter;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Retry with exponential backoff on HTTP 429 from any carrier adapter (spec §8). */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const is429 = error instanceof Error && /429/.test(error.message);
      if (!is429 || attempt === attempts - 1) throw error;
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error("retry-exhausted");
}

/** In-memory per-(merchant, carrier) rate limiter (spec §5: not global). */
class CarrierRateLimiter {
  private lastCall = new Map<string, number>();

  async throttle(key: string, minGapMs: number) {
    const now = Date.now();
    const last = this.lastCall.get(key) ?? 0;
    const wait = last + minGapMs - now;
    if (wait > 0) await sleep(wait);
    this.lastCall.set(key, Date.now());
  }
}

const rateLimiter = new CarrierRateLimiter();
const DEFAULT_MIN_GAP_MS = 300;
const DEFAULT_CONCURRENCY = 10;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Fetch one shipment's status and run it through the shared update function.
 * Used by adaptive polling and manual refresh alike.
 */
async function checkShipment(
  shipment: OrderShipment
): Promise<ApplyShipmentResult> {
  const carrier = await getCarrierById(shipment.carrierId);
  if (!carrier)
    throw new Error(`شركة التوصيل غير موجودة (${shipment.carrierId}).`);
  const credentials = await getMerchantCarrierCredential(
    shipment.merchantId,
    shipment.carrierId
  );
  if (!credentials?.baseUrl || !credentials.token)
    throw new Error(
      `بيانات اعتماد الشركة غير متاحة للطلب ${shipment.orderId}.`
    );

  const adapter = resolveAdapter(carrier);
  await rateLimiter.throttle(
    `${shipment.merchantId}:${shipment.carrierId}`,
    DEFAULT_MIN_GAP_MS
  );
  const { rawLabel } = await withBackoff(() =>
    adapter.getStatus(shipment.trackingNumber, {
      baseUrl: credentials.baseUrl!,
      token: credentials.token,
    })
  );

  const label = rawLabel ?? shipment.externalStatusLabel ?? "";
  const mapping =
    (await getCarrierStatusMapping(shipment.carrierId, label)) ??
    UNKNOWN_MAPPING;
  const computed = computeShipmentUpdate(shipment, label, mapping, new Date());
  return applyShipmentStatus(shipment, label, computed);
}

/**
 * Adaptive polling run (spec §5). Selects due polling shipments, groups them by
 * (merchant, carrier) implicitly via the per-key rate limiter, and checks them
 * with parallel workers — never a sequential loop.
 */
export async function runAdaptivePolling(
  limit = 500
): Promise<{
  checked: number;
  delivered: number;
  returned: number;
  failed: number;
}> {
  const shipments = await listDueShipments(limit);
  let delivered = 0;
  let returned = 0;
  let failed = 0;

  await mapWithConcurrency(shipments, DEFAULT_CONCURRENCY, async shipment => {
    try {
      const result = await checkShipment(shipment);
      if (result.event === "delivered") delivered += 1;
      if (result.event === "returned") returned += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `[ForShip] poll failed for shipment ${shipment.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  });

  return { checked: shipments.length - failed, delivered, returned, failed };
}

/**
 * Reliability fallback (spec §7): webhook shipments stuck non-final with no
 * update for `hours` are switched back to polling as a safety net.
 */
export async function runReliabilityFallback(
  hours = 24
): Promise<{ switched: number }> {
  const stale = await listStaleWebhookShipments(hours);
  let switched = 0;
  for (const shipment of stale) {
    await switchShipmentToPolling(shipment.id, `no-webhook-for-${hours}h`);
    switched += 1;
    console.warn(
      `[ForShip] switched shipment ${shipment.id} to polling after ${hours}h without webhook.`
    );
  }
  return { switched };
}

/**
 * One-time webhook registration with the carrier (spec §3). Only applicable
 * when `carrier.supports_webhook` is true and an endpoint path is configured.
 */
export async function registerCarrierWebhook(
  merchantId: number,
  carrierId: number,
  callbackUrl: string
): Promise<{ registered: boolean }> {
  const carrier = await getCarrierById(carrierId);
  if (!carrier) throw new Error("شركة التوصيل غير موجودة.");
  if (!carrier.supportsWebhook || !carrier.webhookEndpointPath)
    return { registered: false };
  const credentials = await getMerchantCarrierCredential(merchantId, carrierId);
  if (!credentials?.baseUrl)
    throw new Error("اربط الشركة أولًا لتسجيل الـWebhook.");

  const url = `${credentials.baseUrl.replace(/\/+$/, "")}${carrier.webhookEndpointPath}`;
  const response = await withBackoff(() =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: callbackUrl,
        events: ["order.status_changed"],
        token: credentials.token,
      }),
    })
  );
  if (!response.ok)
    throw new Error(`Webhook registration HTTP ${response.status}`);
  await setWebhookRegistered(merchantId, carrierId, true);
  return { registered: true };
}

/**
 * Incoming webhook handler core (spec §3): verify → extract → look up → update.
 * Returns a result suitable for the HTTP layer (always respond 200 quickly).
 */
export async function processIncomingWebhook(
  carrierId: number,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ status: 200 | 404; message: string }> {
  const carrier = await getCarrierById(carrierId);
  if (!carrier) return { status: 404, message: "unknown carrier" };
  if (!verifyWebhookSignature(carrier.webhookSecret, headers, rawBody))
    return { status: 200, message: "ignored: bad signature" };

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 200, message: "ignored: non-json" };
  }

  const parsed = parseWebhookPayload(payload);
  if (!parsed)
    return { status: 200, message: "ignored: missing tracking/status" };

  const shipment = await getShipmentByTracking(
    carrierId,
    parsed.trackingNumber
  );
  if (!shipment) return { status: 200, message: "ignored: unknown tracking" };
  if (shipment.finalStatus)
    return { status: 200, message: "ignored: already resolved" };

  const mapping =
    (await getCarrierStatusMapping(carrierId, parsed.rawLabel)) ??
    UNKNOWN_MAPPING;
  const computed = computeShipmentUpdate(
    shipment,
    parsed.rawLabel,
    mapping,
    new Date()
  );
  await applyShipmentStatus(shipment, parsed.rawLabel, computed);
  return { status: 200, message: "ok" };
}

/** Manual "Refresh now" for a single order (spec §6). Rate-limited to 1/min per order. */
const manualRefreshCooldowns = new Map<number, number>();
const MANUAL_REFRESH_GAP_MS = 60_000;

export async function manualRefreshShipment(
  orderId: number
): Promise<{ results: ApplyShipmentResult[] }> {
  const now = Date.now();
  const last = manualRefreshCooldowns.get(orderId) ?? 0;
  if (now - last < MANUAL_REFRESH_GAP_MS)
    throw new Error("يمكن المزامنة اليدوية مرة واحدة كل دقيقة لنفس الطلب.");
  manualRefreshCooldowns.set(orderId, now);

  const shipments = await listShipmentsByOrder(orderId);
  const results: ApplyShipmentResult[] = [];
  for (const shipment of shipments) {
    if (shipment.finalStatus) continue;
    results.push(await checkShipment(shipment));
  }
  return { results };
}
