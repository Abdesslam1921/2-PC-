import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import {
  carrierStatusMap,
  carriers,
  deliveryCarrierConnections,
  merchantCarrierCredentials,
  orderProfits,
  orderReturns,
  orderShipments,
  storeOrderItems,
  storeOrders,
  type OrderShipment,
} from "../drizzle/schema";
import { getDb } from "./db";
import { applyOrderInventoryLifecycle } from "./db";
import { decryptSecret, encryptSecret } from "./secureSecrets";
import { ECOTRACK_STATUS_MAP } from "./forshipCore";
import { notifyOrderTrackingStatus } from "./trackingRetarget";

/** Resolve (and lazily seed) a carrier row for a given platform/provider key. */
export async function resolveCarrierByProvider(
  provider: string
): Promise<{ id: number; supportsWebhook: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const platformType =
    provider === "ecotrack"
      ? "ecotrack"
      : provider === "yalidine"
        ? "yalidine"
        : "custom";
  const existing = await db
    .select()
    .from(carriers)
    .where(eq(carriers.platformType, platformType))
    .limit(1);
  if (existing.length) {
    if (platformType === "ecotrack")
      await seedEcotrackStatusMap(db, existing[0].id);
    return { id: existing[0].id, supportsWebhook: existing[0].supportsWebhook };
  }
  const created = await db
    .insert(carriers)
    .values({
      name:
        platformType === "ecotrack"
          ? "Ecotrack"
          : platformType === "yalidine"
            ? "Yalidine"
            : "Custom",
      platformType,
      supportsWebhook: false,
    });
  const id = Number(created[0]?.insertId);
  if (!id) throw new Error("تعذر إنشاء سجل شركة التوصيل.");
  if (platformType === "ecotrack") await seedEcotrackStatusMap(db, id);
  return { id, supportsWebhook: false };
}

/** Idempotently ensure the base carrier catalog (Ecotrack + Yalidine) and their status maps exist. */
export async function ensureBaseCarriersSeeded() {
  await resolveCarrierByProvider("ecotrack");
  await resolveCarrierByProvider("yalidine");
}

async function seedEcotrackStatusMap(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  carrierId: number
) {
  for (const [rawLabel, mapping] of Object.entries(ECOTRACK_STATUS_MAP)) {
    await db
      .insert(carrierStatusMap)
      .values({
        carrierId,
        rawLabel,
        mapsTo: mapping.mapsTo,
        isFinal: mapping.isFinal,
      })
      .onDuplicateKeyUpdate({
        set: { mapsTo: mapping.mapsTo, isFinal: mapping.isFinal },
      });
  }
}

export async function listCarriers() {
  const db = await getDb();
  if (!db) return [];
  await ensureBaseCarriersSeeded();
  return db.select().from(carriers).orderBy(asc(carriers.id));
}

export async function getCarrierById(carrierId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(carriers)
    .where(eq(carriers.id, carrierId))
    .limit(1);
  return row;
}

export async function getMerchantCarrierCredential(
  merchantId: number,
  carrierId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(merchantCarrierCredentials)
    .where(
      and(
        eq(merchantCarrierCredentials.merchantId, merchantId),
        eq(merchantCarrierCredentials.carrierId, carrierId),
        eq(merchantCarrierCredentials.isActive, true)
      )
    )
    .limit(1);
  if (!row?.apiTokenEncrypted) return undefined;
  try {
    return {
      id: row.id,
      baseUrl: row.apiBaseUrl ?? undefined,
      token: decryptSecret(row.apiTokenEncrypted),
      webhookRegistered: row.webhookRegistered,
    };
  } catch {
    return undefined;
  }
}

/**
 * True when this merchant's carrier pushes webhooks. The automatic polling
 * scheduler then skips it (the webhook keeps the status fresh), while the
 * manual "sync" button always stays available.
 */
export async function merchantCarrierHasWebhook(
  merchantId: number,
  provider: string
): Promise<boolean> {
  try {
    const carrier = await resolveCarrierByProvider(provider);
    if (carrier.supportsWebhook) return true;
    const credential = await getMerchantCarrierCredential(
      merchantId,
      carrier.id
    );
    return Boolean(credential?.webhookRegistered);
  } catch {
    return false;
  }
}

export async function saveMerchantCarrierCredential(
  merchantId: number,
  carrierId: number,
  input: { apiBaseUrl?: string; apiToken: string }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    merchantId,
    carrierId,
    apiBaseUrl: input.apiBaseUrl?.trim() || null,
    apiTokenEncrypted: encryptSecret(input.apiToken),
    isActive: true,
  };
  await db
    .insert(merchantCarrierCredentials)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        apiBaseUrl: values.apiBaseUrl,
        apiTokenEncrypted: values.apiTokenEncrypted,
        isActive: true,
      },
    });
}

export async function setWebhookRegistered(
  merchantId: number,
  carrierId: number,
  registered: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .insert(merchantCarrierCredentials)
    .values({ merchantId, carrierId, webhookRegistered: registered })
    .onDuplicateKeyUpdate({ set: { webhookRegistered: registered } });
}

export async function getCarrierStatusMapping(
  carrierId: number,
  rawLabel: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(carrierStatusMap)
    .where(
      and(
        eq(carrierStatusMap.carrierId, carrierId),
        eq(carrierStatusMap.rawLabel, rawLabel)
      )
    )
    .limit(1);
  return row ? { mapsTo: row.mapsTo, isFinal: row.isFinal } : undefined;
}

export type ShipmentSeed = {
  orderId: number;
  merchantId: number;
  carrierId: number;
  trackingNumber: string;
  supportsWebhook: boolean;
};

export async function ensureOrderShipment(seed: ShipmentSeed) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const now = new Date();
  const values = {
    orderId: seed.orderId,
    merchantId: seed.merchantId,
    carrierId: seed.carrierId,
    trackingNumber: seed.trackingNumber,
    syncMethod: seed.supportsWebhook
      ? ("webhook" as const)
      : ("polling" as const),
    nextCheckAt: seed.supportsWebhook ? null : now,
    statusEnteredAt: null,
    statusHistory: "[]",
  };
  await db
    .insert(orderShipments)
    .values(values)
    .onDuplicateKeyUpdate({
      set: { trackingNumber: seed.trackingNumber, merchantId: seed.merchantId },
    });
  return getShipmentByOrder(seed.orderId, seed.carrierId);
}

export async function getShipmentByOrder(orderId: number, carrierId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(orderShipments)
    .where(
      and(
        eq(orderShipments.orderId, orderId),
        eq(orderShipments.carrierId, carrierId)
      )
    )
    .limit(1);
  return row;
}

export async function getShipmentByTracking(
  carrierId: number,
  trackingNumber: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(orderShipments)
    .where(
      and(
        eq(orderShipments.carrierId, carrierId),
        eq(orderShipments.trackingNumber, trackingNumber)
      )
    )
    .limit(1);
  return row;
}

export async function getShipmentById(shipmentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.id, shipmentId))
    .limit(1);
  return row;
}

export async function listShipmentsByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.orderId, orderId))
    .orderBy(asc(orderShipments.id));
}

export async function listStoreShipments(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select({ id: storeOrders.id })
    .from(storeOrders)
    .where(eq(storeOrders.storeId, storeId));
  const ids = orders.map(order => order.id);
  if (!ids.length) return [];
  return db
    .select()
    .from(orderShipments)
    .where(inArray(orderShipments.orderId, ids))
    .orderBy(desc(orderShipments.createdAt));
}

/**
 * Integration point: when a tracking number is assigned to an order, create
 * (or sync) its ForShip shipment row and mirror the merchant credential so the
 * tracking engine has everything it needs.
 *
 * Deliberately non-fatal: tracking initialization must never break the
 * underlying upload/sync flow, so any ForShip failure is logged and swallowed.
 */
export async function ensureShipmentForOrder(storeId: number, orderId: number) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const [order] = await db
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
      .limit(1);
    if (!order?.carrierTracking) return undefined;

    let provider = "ecotrack";
    if (order.carrierConnectionId) {
      const [connection] = await db
        .select()
        .from(deliveryCarrierConnections)
        .where(eq(deliveryCarrierConnections.id, order.carrierConnectionId))
        .limit(1);
      if (connection) {
        provider = connection.provider;
        if (connection.apiBaseUrl && connection.apiTokenEncrypted) {
          try {
            await saveMerchantCarrierCredential(
              order.ownerId,
              (await resolveCarrierByProvider(provider)).id,
              {
                apiBaseUrl: connection.apiBaseUrl,
                apiToken: decryptSecret(connection.apiTokenEncrypted),
              }
            );
          } catch {
            /* keep existing credential if decryption/upsert fails */
          }
        }
      }
    }

    const carrier = await resolveCarrierByProvider(provider);
    return await ensureOrderShipment({
      orderId: order.id,
      merchantId: order.ownerId,
      carrierId: carrier.id,
      trackingNumber: order.carrierTracking,
      supportsWebhook: carrier.supportsWebhook,
    });
  } catch (error) {
    console.warn(
      `[ForShip] ensureShipmentForOrder skipped for order ${orderId}:`,
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

/** Adaptive-polling due scan (spec §5). Composite index (final_status, next_check_at) backs this. */
export async function listDueShipments(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orderShipments)
    .where(
      and(
        isNull(orderShipments.finalStatus),
        eq(orderShipments.syncMethod, "polling"),
        lt(orderShipments.nextCheckAt, new Date())
      )
    )
    .orderBy(asc(orderShipments.nextCheckAt))
    .limit(limit);
}

/** Webhook safety-net scan: webhook shipments stuck non-final with no update in `hours` (spec §7). */
export async function listStaleWebhookShipments(hours: number) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db
    .select()
    .from(orderShipments)
    .where(
      and(
        isNull(orderShipments.finalStatus),
        eq(orderShipments.syncMethod, "webhook"),
        or(
          isNull(orderShipments.statusEnteredAt),
          lt(orderShipments.statusEnteredAt, cutoff)
        )
      )
    )
    .limit(500);
}

export async function switchShipmentToPolling(
  shipmentId: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .update(orderShipments)
    .set({
      syncMethod: "polling",
      nextCheckAt: new Date(),
      fallbackReason: reason,
    })
    .where(
      and(eq(orderShipments.id, shipmentId), isNull(orderShipments.finalStatus))
    );
  return getShipmentById(shipmentId);
}

function parseHistory(value: unknown): Array<{ label: string; at: string }> {
  if (Array.isArray(value))
    return value as Array<{ label: string; at: string }>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type ApplyShipmentResult = {
  shipment: OrderShipment;
  changed: boolean;
  event: "delivered" | "returned" | null;
};

/**
 * Persist the shared update (spec §4) for a shipment. Used by BOTH webhook and
 * polling — this is the single convergence point that writes status changes.
 */
export async function applyShipmentStatus(
  shipment: OrderShipment,
  rawLabel: string,
  computed: ReturnType<typeof import("./forshipCore").computeShipmentUpdate>
): Promise<ApplyShipmentResult> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const now = new Date();
  const history = parseHistory(shipment.statusHistory);
  const nextHistory = computed.historyEntry
    ? [...history, computed.historyEntry]
    : history;

  await db
    .update(orderShipments)
    .set({
      ...(computed.changed
        ? {
            externalStatusLabel: computed.externalStatusLabel,
            internalStatus: computed.internalStatus,
            statusEnteredAt: now,
          }
        : {}),
      statusHistory: JSON.stringify(nextHistory),
      finalStatus: computed.finalStatus,
      resolvedAt: computed.resolvedAt,
      nextCheckAt: computed.nextCheckAt,
      reviewFlagged: computed.reviewFlagged || shipment.reviewFlagged,
      lastCheckedAt: now,
      checkCount: shipment.checkCount + 1,
    })
    .where(eq(orderShipments.id, shipment.id));

  const updated = (await getShipmentById(shipment.id)) ?? shipment;
  if (computed.event) await handleFinalEvent(updated, computed.event);
  if (computed.changed) {
    void notifyOrderTrackingStatus(shipment.orderId, {
      raw: updated.externalStatusLabel ?? rawLabel,
      internalStatus: updated.internalStatus ?? computed.internalStatus,
      fulfillmentStatus:
        computed.event === "delivered"
          ? "delivered"
          : computed.event === "returned"
            ? "returned"
            : null,
      terminalEvent: computed.event,
    });
  }
  return {
    shipment: updated,
    changed: computed.changed,
    event: computed.event,
  };
}

async function handleFinalEvent(
  shipment: OrderShipment,
  event: "delivered" | "returned"
) {
  const db = await getDb();
  if (!db) return;
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.id, shipment.orderId))
    .limit(1);
  if (!order) return;

  if (event === "delivered") {
    await recordOrderProfit(db, order.id, order.ownerId);
  } else {
    if (order.storeId != null)
      await applyOrderInventoryLifecycle(order.storeId, order.id, "returned");
    await recordOrderReturn(db, order.id, order.ownerId);
  }

  // Keep the legacy order row in sync with the ForShip terminal state.
  const finalFulfillment = event === "delivered" ? "delivered" : "returned";
  await db
    .update(storeOrders)
    .set({
      carrierStatus: shipment.externalStatusLabel ?? undefined,
      carrierStatusUpdatedAt: new Date(),
      fulfillmentStatus: finalFulfillment,
    })
    .where(eq(storeOrders.id, order.id));
}

async function recordOrderProfit(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orderId: number,
  merchantId: number
) {
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.id, orderId))
    .limit(1);
  if (!order) return;
  const items = await db
    .select()
    .from(storeOrderItems)
    .where(eq(storeOrderItems.orderId, orderId));
  const toNum = (value: unknown) => Number(value ?? 0) || 0;
  const costOfGoods = items.reduce(
    (sum, item) =>
      sum +
      (toNum(item.productCostSnapshot) +
        toNum(item.packagingCostSnapshot) +
        toNum(item.procurementDeliveryCostSnapshot)) *
        item.quantity,
    0
  );
  const revenue = toNum(order.total);
  const deliveryCost =
    toNum(order.deliveryFee) || toNum(order.deliveryCostSnapshot);
  const netProfit = revenue - costOfGoods - deliveryCost;
  await db
    .insert(orderProfits)
    .values({
      orderId,
      merchantId,
      revenue: revenue.toFixed(2),
      costOfGoods: costOfGoods.toFixed(2),
      deliveryCost: deliveryCost.toFixed(2),
      netProfit: netProfit.toFixed(2),
      resolvedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        revenue: revenue.toFixed(2),
        costOfGoods: costOfGoods.toFixed(2),
        deliveryCost: deliveryCost.toFixed(2),
        netProfit: netProfit.toFixed(2),
        resolvedAt: new Date(),
      },
    });
}

async function recordOrderReturn(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orderId: number,
  merchantId: number
) {
  const items = await db
    .select()
    .from(storeOrderItems)
    .where(eq(storeOrderItems.orderId, orderId));
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.id, orderId))
    .limit(1);
  const toNum = (value: unknown) => Number(value ?? 0) || 0;
  const returnCost = items.reduce(
    (sum, item) => sum + toNum(item.returnCostSnapshot) * item.quantity,
    0
  );
  const stockRestocked = Boolean(order?.inventoryRestoredAt);
  await db
    .insert(orderReturns)
    .values({
      orderId,
      merchantId,
      returnCost: returnCost.toFixed(2),
      stockRestocked,
      resolvedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        returnCost: returnCost.toFixed(2),
        stockRestocked,
        resolvedAt: new Date(),
      },
    });
}
