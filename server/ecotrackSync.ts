import { asc, eq } from "drizzle-orm";
import { stores } from "../drizzle/schema";
import { getCarrierCredentials, getDb, listStoreOrders, updateOrderCarrierData } from "./db";
import { getEcotrackTrackingInfo } from "./ecotrack";

const FINAL_STATUSES = new Set(["delivered", "returned", "cancelled", "customer_unresponsive", "phone_cancelled", "fake"]);

export type EcotrackSyncSummary = { synced: number; delivered: number; returned: number; cancelled: number };

/**
 * Sync the live Ecotrack status of every tracked, non-final order in a store.
 * Shared by the manual "sync all" button and the automatic polling scheduler.
 */
export async function syncStoreEcotrackStatuses(storeId: number): Promise<EcotrackSyncSummary> {
  const orders = (await listStoreOrders(storeId)).filter(order => Boolean(order.carrierTracking) && !FINAL_STATUSES.has(order.fulfillmentStatus));
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
      const mapped = status === "livred" || status === "encassed" || status === "payed" ? "delivered" : status === "return_received" ? "returned" : undefined;
      await updateOrderCarrierData(storeId, order.id, { carrierStatus: status ?? undefined, carrierStatusUpdatedAt: new Date(), ...(mapped ? { fulfillmentStatus: mapped } : {}) });
      synced += 1;
      if (mapped === "delivered") delivered += 1;
      else if (mapped === "returned") returned += 1;
    } catch (error) {
      if (error instanceof Error && /404|not found|introuvable|inexistante/i.test(error.message)) {
        await updateOrderCarrierData(storeId, order.id, { carrierStatus: "cancelled", carrierStatusUpdatedAt: new Date(), fulfillmentStatus: "cancelled" });
        cancelled += 1;
      }
    }
  }

  return { synced, delivered, returned, cancelled };
}

/**
 * Run the Ecotrack status sync across every active store. Used by the
 * automatic polling scheduler (in-process interval + `/api/scheduled/` cron).
 */
export async function syncAllStoresEcotrackStatuses(): Promise<EcotrackSyncSummary & { stores: number }> {
  const db = await getDb();
  if (!db) return { stores: 0, synced: 0, delivered: 0, returned: 0, cancelled: 0 };

  const activeStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.isActive, true)).orderBy(asc(stores.id));

  const summary: EcotrackSyncSummary & { stores: number } = { stores: activeStores.length, synced: 0, delivered: 0, returned: 0, cancelled: 0 };
  for (const store of activeStores) {
    try {
      const result = await syncStoreEcotrackStatuses(store.id);
      summary.synced += result.synced;
      summary.delivered += result.delivered;
      summary.returned += result.returned;
      summary.cancelled += result.cancelled;
    } catch (error) {
      console.warn(`[ForShip auto-sync] store ${store.id} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}
