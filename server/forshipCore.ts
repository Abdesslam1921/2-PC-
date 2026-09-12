import crypto from "node:crypto";
import type {
  CarrierFinalStatus,
  CarrierInternalStatus,
  OrderShipment,
} from "../drizzle/schema";

/**
 * Pure, side-effect-free rules for the ForShip tracking engine.
 * Both webhook push and adaptive polling converge on `computeShipmentUpdate`.
 */

export type ResolvedStatusMap = {
  mapsTo: CarrierInternalStatus;
  isFinal: boolean;
};

export type ShipmentUpdateResult = {
  changed: boolean;
  externalStatusLabel: string;
  internalStatus: CarrierInternalStatus | null;
  finalStatus: CarrierFinalStatus | null;
  resolvedAt: Date | null;
  nextCheckAt: Date | null;
  historyEntry: { label: string; at: string } | null;
  event: "delivered" | "returned" | null;
  reviewFlagged: boolean;
};

export const UNKNOWN_MAPPING: ResolvedStatusMap = {
  mapsTo: "other",
  isFinal: false,
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Adaptive polling intervals by internal status. */
export const POLL_INTERVALS_MS: Record<CarrierInternalStatus, number> = {
  // en préparation / en ramassage / vers station / en station / vers wilaya
  in_transit: 5 * HOUR_MS,
  // En Livraison
  out_for_delivery: 20 * MINUTE_MS,
  // suspendu — NOT final, deprioritized but still rechecked
  suspended: 6 * HOUR_MS,
  other: 5 * HOUR_MS,
  // delivered / returned are final and never polled
  delivered: 0,
  returned: 0,
};

/** A shipment whose raw label stops changing for this long gets deprioritized + flagged. */
export const NO_CHANGE_FLAG_AFTER_MS = 5 * 24 * HOUR_MS;
/** Interval used once a shipment is flagged for manual review (12–24h). */
export const NO_CHANGE_INTERVAL_MS = 18 * HOUR_MS;

export function intervalFor(status: CarrierInternalStatus): number {
  return POLL_INTERVALS_MS[status] ?? POLL_INTERVALS_MS.other;
}

/**
 * Core shared update function (spec §4). Pure: takes the current shipment,
 * the raw label received from the carrier, and the resolved status mapping,
 * and returns the exact mutations + event without touching the DB.
 */
export function computeShipmentUpdate(
  shipment: Pick<
    OrderShipment,
    "externalStatusLabel" | "statusEnteredAt" | "syncMethod" | "reviewFlagged"
  >,
  rawLabel: string,
  mapping: ResolvedStatusMap,
  now: Date
): ShipmentUpdateResult {
  const label = rawLabel ?? "";
  const previousLabel = shipment.externalStatusLabel ?? "";

  if (label === previousLabel) {
    const statusEnteredAt = shipment.statusEnteredAt?.getTime() ?? 0;
    const stale =
      statusEnteredAt > 0 &&
      now.getTime() - statusEnteredAt >= NO_CHANGE_FLAG_AFTER_MS;
    const shouldFlag = stale && !shipment.reviewFlagged;
    return {
      changed: false,
      externalStatusLabel: previousLabel,
      internalStatus: null,
      finalStatus: null,
      resolvedAt: null,
      nextCheckAt:
        shipment.syncMethod === "polling"
          ? new Date(
              now.getTime() +
                (stale ? NO_CHANGE_INTERVAL_MS : intervalFor("in_transit"))
            )
          : null,
      historyEntry: null,
      event: null,
      reviewFlagged: shouldFlag,
    };
  }

  const internalStatus = mapping.mapsTo;
  const result: ShipmentUpdateResult = {
    changed: true,
    externalStatusLabel: label,
    internalStatus,
    finalStatus: null,
    resolvedAt: null,
    nextCheckAt: null,
    historyEntry: { label, at: now.toISOString() },
    event: null,
    reviewFlagged: false,
  };

  if (mapping.isFinal && internalStatus === "delivered") {
    result.finalStatus = "delivered";
    result.resolvedAt = now;
    result.nextCheckAt = null;
    result.event = "delivered";
  } else if (mapping.isFinal && internalStatus === "returned") {
    result.finalStatus = "returned";
    result.resolvedAt = now;
    result.nextCheckAt = null;
    result.event = "returned";
  } else if (shipment.syncMethod === "polling") {
    result.nextCheckAt = new Date(now.getTime() + intervalFor(internalStatus));
  }

  return result;
}

const TRACKING_KEYS = [
  "tracking_number",
  "trackingNumber",
  "tracking",
  "awb",
  "tracking_code",
  "reference",
];
const STATUS_KEYS = [
  "raw_label",
  "rawLabel",
  "status",
  "label",
  "event",
  "status_label",
  "statut",
];

/**
 * Tolerant extraction of `trackingNumber` and `rawLabel` from an incoming
 * webhook body (spec §3). Accepts flat or lightly nested payloads.
 */
export function parseWebhookPayload(
  body: unknown
): { trackingNumber: string; rawLabel: string } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const trackingNumber =
    pickFirstString(record, TRACKING_KEYS) ??
    pickFirstString(
      record.data as Record<string, unknown> | undefined,
      TRACKING_KEYS
    );
  const rawLabel =
    pickFirstString(record, STATUS_KEYS) ??
    pickFirstString(
      record.data as Record<string, unknown> | undefined,
      STATUS_KEYS
    );
  if (!trackingNumber || rawLabel === undefined) return null;
  return { trackingNumber: String(trackingNumber), rawLabel: String(rawLabel) };
}

function pickFirstString(
  source: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * HMAC-SHA256 signature verification for webhook carriers that share a secret.
 * Carriers without a configured secret skip verification.
 */
export function verifyWebhookSignature(
  secret: string | null | undefined,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): boolean {
  if (!secret) return true;
  const signature =
    headerValue(headers["x-forship-signature"]) ??
    headerValue(headers["x-carrier-signature"]);
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(expected, String(signature));
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Maps the well-known Ecotrack documented statuses to internal ForShip states. */
export const ECOTRACK_STATUS_MAP: Record<string, ResolvedStatusMap> = {
  order_information_received_by_carrier: {
    mapsTo: "in_transit",
    isFinal: false,
  },
  picked: { mapsTo: "in_transit", isFinal: false },
  accepted_by_carrier: { mapsTo: "in_transit", isFinal: false },
  dispatched_to_driver: { mapsTo: "out_for_delivery", isFinal: false },
  attempt_delivery: { mapsTo: "out_for_delivery", isFinal: false },
  return_asked: { mapsTo: "in_transit", isFinal: false },
  return_in_transit: { mapsTo: "in_transit", isFinal: false },
  return_received: { mapsTo: "returned", isFinal: true },
  livred: { mapsTo: "delivered", isFinal: true },
  encassed: { mapsTo: "delivered", isFinal: true },
  payed: { mapsTo: "delivered", isFinal: true },
};
