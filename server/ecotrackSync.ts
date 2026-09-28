import { asc, eq } from "drizzle-orm";
import { stores } from "../drizzle/schema";
import { getCarrierCredentials, getDb, listStoreOrders, updateOrderCarrierData } from "./db";
import { getEcotrackTrackingInfo } from "./ecotrack";
import { carrierLabelToFulfillment } from "./forshipCore";
import { merchantCarrierHasWebhook } from "./forshipDb";

const FINAL_STATUSES = new Set(["delivered", "returned", "cancelled", "customer_unresponsive", "phone_cancelled", "fake"]);

export type EcotrackSyncSummary = { synced: number; delivered: number; returned: number; cancelled: number };

export type EcotrackSyncOptions = {
  /** Manual syncs include final orders so a newer carrier status still wins. */
  includeFinal?: boolean;
  /** Auto-polling skips carriers that push webhooks (the webhook stays authoritative). */
  skipWebhookCarriers?: boolean;
};

/**
 * Sync the live Ecotrack status of tracked orders in a store.
 *
 * Hybrid rule (spec): a manual merchant edit stands until the next sync. On a
 * sync the carrier status is compared with the current one — equal keeps it,
 * different is applied regardless of whether the last change was manual.
 */
export async function syncStoreEcotrackStatuses(
  storeId: number,
  options: EcotrackSyncOptions = {}
): Promise<EcotrackSyncSummary> {
  const { includeFinal = true, skipWebhookCarriers = false } = options;
  const candidates = (await listStoreOrders(storeId)).filter(order => {
    if (!order.carrierTracking) return false;
    return includeFinal || !FINAL_STATUSES.has(order.fulfillmentStatus);
  });
  if (!candidates.length) return { synced: 0, delivered: 0, returned: 0, cancelled: 0 };

  const webhookCache = new Map<number, boolean>();
  const orders: typeof candidates = [];
  for (const order of candidates) {
    if (skipWebhookCarriers) {
      let hasWebhook = webhookCache.get(order.ownerId);
      if (hasWebhook === undefined) {
        hasWebhook = await merchantCarrierHasWebhook(order.ownerId, "ecotrack");
        webhookCache.set(order.ownerId, hasWebhook);
      }
      if (hasWebhook) continue;
    }
    orders.push(order);
  }
  if (!orders.length) return { synced: 0, delivered: 0, returned: 0, cancelled: 0 };

  const credentialsCache = new Map<number, Awaited<ReturnType<typeof getCarrierCredentials>>>();
  let synced = 0;
  let delivered = 0;
  let returned = 0;
  let cancelled = 0;

  for (const order of orders) {
    const key = order.carrierConnectionId ?? -1;
    let credentials = credentialsCache.get(key);
    if (credentials === undefined) {
      credentials = await getCarrierCredentials(storeId, "ecotrack", order.carrierConnectionId ?? undefined);
      credentialsCache.set(key, credentials);
    }
    if (!credentials) continue;

    try {
      const result = await getEcotrackTrackingInfo(credentials, order.carrierTracking!);
      const status = result.status;
      const mapped = carrierLabelToFulfillment(status);
      // Hybrid rule: only overwrite when the carrier state actually differs.
      const nextFulfillment = mapped && mapped !== order.fulfillmentStatus ? mapped : undefined;
      await updateOrderCarrierData(storeId, order.id, { carrierStatus: status ?? undefined, carrierStatusUpdatedAt: new Date(), ...(nextFulfillment ? { fulfillmentStatus: nextFulfillment } : {}) });
      synced += 1;
      if (nextFulfillment === "delivered") delivered += 1;
      else if (nextFulfillment === "returned") returned += 1;
    } catch (error) {
      if (error instanceof Error && /404|not found|introuvable|inexistante/i.test(error.message)) {
        const alreadyCancelled = order.fulfillmentStatus === "cancelled";
        await updateOrderCarrierData(storeId, order.id, { carrierStatus: "cancelled", carrierStatusUpdatedAt: new Date(), ...(alreadyCancelled ? {} : { fulfillmentStatus: "cancelled" }) });
        cancelled += 1;
      }
    }
  }

  return { synced, delivered, returned, cancelled };
}

/**
 * Run the Ecotrack status sync across every active store. Used by the automatic
 * polling scheduler (in-process interval + `/api/scheduled/` cron).
 *
 * Auto mode never fights the merchant: it skips final orders (already resolved)
 * and carriers that push webhooks (the webhook keeps them fresh). The manual
 * "sync" button keeps full coverage.
 */
export async function syncAllStoresEcotrackStatuses(): Promise<EcotrackSyncSummary & { stores: number }> {
  const db = await getDb();
  if (!db) return { stores: 0, synced: 0, delivered: 0, returned: 0, cancelled: 0 };

  const activeStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.isActive, true)).orderBy(asc(stores.id));

  const summary: EcotrackSyncSummary & { stores: number } = { stores: activeStores.length, synced: 0, delivered: 0, returned: 0, cancelled: 0 };
  for (const store of activeStores) {
    try {
      const result = await syncStoreEcotrackStatuses(store.id, {
        includeFinal: false,
        skipWebhookCarriers: true,
      });
      summary.synced += result.synced;
      summary.delivered += result.delivered;
      summary.returned += result.returned;
      summary.cancelled += result.cancelled;
    } catch (error) {
      console.warn(`[ProShip auto-sync] store ${store.id} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}
