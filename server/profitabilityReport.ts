import { and, desc, eq } from "drizzle-orm";
import {
  metaAdAccounts,
  metaAdInsights,
  metaCampaigns,
  profitabilityCampaignLinks,
  profitabilitySettings,
  storeOrderItems,
  storeOrders,
} from "../drizzle/schema";
import { getDb } from "./db";

const cents = (value: string | number | null | undefined) =>
  Math.round((Number(value ?? 0) || 0) * 100);
const money = (value: number) => (value / 100).toFixed(2);
export const PROFITABILITY_FINAL_STATUSES = [
  "delivered",
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
] as const;
const finalStatuses = new Set<string>(PROFITABILITY_FINAL_STATUSES);

type CampaignRow = {
  campaignId: string;
  campaignName: string;
  revenue: number;
  adSpend: number;
  trueProfit: number;
  orders: number;
  impressions: number;
  clicks: number;
  purchases: number;
  source: "order" | "meta" | "order+meta";
};

export async function getProfitabilityReport(storeId: number) {
  const db = await getDb();
  if (!db) return emptyReport();
  const [settings] = await db
    .select()
    .from(profitabilitySettings)
    .where(eq(profitabilitySettings.storeId, storeId))
    .limit(1);
  const orders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.storeId, storeId))
    .orderBy(desc(storeOrders.createdAt));
  const allItems = orders.length
    ? await Promise.all(
        orders.map(order =>
          db
            .select()
            .from(storeOrderItems)
            .where(eq(storeOrderItems.orderId, order.id))
        )
      )
    : [];
  const flatItems = allItems.flat();
  const totals = {
    revenue: 0,
    adSpend: 0,
    productCost: 0,
    packagingCost: 0,
    procurementDeliveryCost: 0,
    deliveryCost: 0,
    confirmationCost: 0,
    returnCost: 0,
    totalCost: 0,
    trueProfit: 0,
  };
  const productMap = new Map<
    number,
    {
      productId: number;
      title: string;
      revenue: number;
      totalCost: number;
      trueProfit: number;
      quantity: number;
      adSpend: number;
    }
  >();
  const campaignMap = new Map<string, CampaignRow>();
  const orderRows: Array<{
    orderId: number;
    orderNumber: string;
    status: string;
    campaign: string | null;
    revenue: number;
    totalCost: number;
    trueProfit: number;
  }> = [];
  let deliveredOrders = 0;
  let returnedOrders = 0;
  let pendingOrders = 0;
  let excludedOrders = 0;

  for (const order of orders) {
    const orderItems = flatItems.filter(item => item.orderId === order.id);
    const isDelivered = order.fulfillmentStatus === "delivered";
    const isReturned = order.fulfillmentStatus === "returned";
    if (!finalStatuses.has(order.fulfillmentStatus)) {
      pendingOrders++;
      if (!settings?.includePendingOrders) continue;
    }
    if (
      [
        "cancelled",
        "customer_unresponsive",
        "phone_cancelled",
        "fake",
      ].includes(order.fulfillmentStatus)
    ) {
      excludedOrders++;
      continue;
    }
    if (isDelivered) deliveredOrders++;
    if (isReturned) returnedOrders++;
    const adSpend = cents(order.adSpendAllocatedDzd);
    const itemRevenue = isDelivered
      ? orderItems.reduce((sum, item) => sum + cents(item.lineTotal), 0)
      : 0;
    const productCost = orderItems.reduce(
      (sum, item) => sum + cents(item.productCostSnapshot) * item.quantity,
      0
    );
    const packagingCost = orderItems.reduce(
      (sum, item) => sum + cents(item.packagingCostSnapshot) * item.quantity,
      0
    );
    const procurementDeliveryCost = orderItems.reduce(
      (sum, item) =>
        sum + cents(item.procurementDeliveryCostSnapshot) * item.quantity,
      0
    );
    const returnCost = isReturned
      ? orderItems.reduce(
          (sum, item) =>
            sum +
            (item.returnDeliveryFreeSnapshot
              ? 0
              : cents(item.returnCostSnapshot)),
          0
        )
      : 0;
    const confirmationCost = orderItems.reduce(
      (sum, item) =>
        sum +
        (item.confirmationSource === "call_center"
          ? cents(
              isDelivered
                ? item.deliveredConfirmationCostSnapshot
                : item.normalConfirmationCostSnapshot
            )
          : 0),
      0
    );
    const deliveryCost = cents(order.deliveryCostSnapshot);
    const totalCost =
      productCost +
      packagingCost +
      procurementDeliveryCost +
      deliveryCost +
      confirmationCost +
      returnCost +
      adSpend;
    const trueProfit = itemRevenue - totalCost;
    const campaignId = order.metaCampaignId || order.utmCampaign || null;
    orderRows.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.fulfillmentStatus,
      campaign: campaignId,
      revenue: itemRevenue,
      totalCost,
      trueProfit,
    });
    totals.revenue += itemRevenue;
    totals.adSpend += adSpend;
    totals.productCost += productCost;
    totals.packagingCost += packagingCost;
    totals.procurementDeliveryCost += procurementDeliveryCost;
    totals.deliveryCost += deliveryCost;
    totals.confirmationCost += confirmationCost;
    totals.returnCost += returnCost;
    totals.totalCost += totalCost;
    totals.trueProfit += trueProfit;
    if (campaignId) {
      const current = campaignMap.get(campaignId) ?? {
        campaignId,
        campaignName: campaignId,
        revenue: 0,
        adSpend: 0,
        trueProfit: 0,
        orders: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        source: "order" as const,
      };
      current.revenue += itemRevenue;
      current.adSpend += adSpend;
      current.trueProfit += trueProfit;
      current.orders += 1;
      campaignMap.set(campaignId, current);
    }
    for (const item of orderItems) {
      const current = productMap.get(item.productId) ?? {
        productId: item.productId,
        title: item.title,
        revenue: 0,
        totalCost: 0,
        trueProfit: 0,
        quantity: 0,
        adSpend: 0,
      };
      const lineBase = orderItems.reduce(
        (sum, row) => sum + cents(row.lineTotal),
        0
      );
      const share = orderItems.length
        ? Math.round(adSpend * (cents(item.lineTotal) / Math.max(1, lineBase)))
        : 0;
      const itemCost =
        cents(item.productCostSnapshot) * item.quantity +
        cents(item.packagingCostSnapshot) * item.quantity +
        cents(item.procurementDeliveryCostSnapshot) * item.quantity +
        share;
      current.revenue += isDelivered ? cents(item.lineTotal) : 0;
      current.totalCost += itemCost;
      current.trueProfit +=
        (isDelivered ? cents(item.lineTotal) : 0) - itemCost;
      current.quantity += item.quantity;
      productMap.set(item.productId, current);
    }
  }

  const accountRows = await db
    .select({ id: metaAdAccounts.id })
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.storeId, storeId));
  const accountIds = new Set(accountRows.map(row => row.id));
  const insightRows = (await db.select().from(metaAdInsights)).filter(row =>
    accountIds.has(row.adAccountId)
  );
  const campaignRows = (await db.select().from(metaCampaigns)).filter(row =>
    accountIds.has(row.adAccountId)
  );
  const campaignNames = new Map(
    campaignRows.map(row => [String(row.externalId), row.name])
  );
  let metaSpendDzd = 0;
  for (const insight of insightRows) {
    const spend = cents(insight.spendDzd);
    metaSpendDzd += spend;
    const key = insight.externalObjectId;
    const existing = campaignMap.get(key) ?? {
      campaignId: key,
      campaignName: campaignNames.get(key) || key,
      revenue: 0,
      adSpend: 0,
      trueProfit: 0,
      orders: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      source: "meta" as const,
    };
    const allocatedBeforeMeta = existing.adSpend;
    existing.adSpend = spend;
    existing.trueProfit += allocatedBeforeMeta - spend;
    existing.impressions += insight.impressions;
    existing.clicks += insight.clicks;
    existing.purchases += insight.purchases;
    existing.campaignName = campaignNames.get(key) || existing.campaignName;
    existing.source = existing.orders ? "order+meta" : "meta";
    campaignMap.set(key, existing);
  }
  const campaignLinks = await db
    .select()
    .from(profitabilityCampaignLinks)
    .where(eq(profitabilityCampaignLinks.storeId, storeId));
  const linkedProductByCampaign = new Map(
    campaignLinks.map(link => [link.campaignExternalId, link.productId])
  );
  const linkedProductSpend = new Map<number, number>();
  for (const insight of insightRows) {
    const productId = linkedProductByCampaign.get(insight.externalObjectId);
    if (!productId) continue;
    linkedProductSpend.set(
      productId,
      (linkedProductSpend.get(productId) ?? 0) + cents(insight.spendDzd)
    );
  }
  for (const [productId, spendCents] of Array.from(linkedProductSpend)) {
    const product = productMap.get(productId);
    if (!product) continue;
    product.adSpend += spendCents;
    product.totalCost += spendCents;
    product.trueProfit -= spendCents;
  }
  const effectiveAdSpend = totals.adSpend || metaSpendDzd;
  const totalCostWithMeta =
    totals.totalCost - totals.adSpend + effectiveAdSpend;
  const trueProfitWithMeta = totals.revenue - totalCostWithMeta;
  return {
    totals: {
      revenue: money(totals.revenue),
      adSpend: money(effectiveAdSpend),
      productCost: money(totals.productCost),
      packagingCost: money(totals.packagingCost),
      procurementDeliveryCost: money(totals.procurementDeliveryCost),
      deliveryCost: money(totals.deliveryCost),
      confirmationCost: money(totals.confirmationCost),
      returnCost: money(totals.returnCost),
      totalCost: money(totalCostWithMeta),
      trueProfit: money(trueProfitWithMeta),
      profitMargin: totals.revenue
        ? `${((trueProfitWithMeta / totals.revenue) * 100).toFixed(2)}%`
        : "0.00%",
      cpa: deliveredOrders
        ? money(Math.round(effectiveAdSpend / deliveredOrders))
        : "0.00",
      roas: effectiveAdSpend
        ? (totals.revenue / effectiveAdSpend).toFixed(2)
        : "0.00",
    },
    counts: { deliveredOrders, returnedOrders, pendingOrders, excludedOrders },
    byProduct: Array.from(productMap.values())
      .map(row => ({
        ...row,
        revenue: money(row.revenue),
        totalCost: money(row.totalCost),
        trueProfit: money(row.trueProfit),
        adSpend: money(row.adSpend),
      }))
      .sort((a, b) => Number(b.trueProfit) - Number(a.trueProfit)),
    byCampaign: Array.from(campaignMap.values())
      .map(row => ({
        ...row,
        revenue: money(row.revenue),
        adSpend: money(row.adSpend),
        trueProfit: money(row.trueProfit),
        roas: row.adSpend ? (row.revenue / row.adSpend).toFixed(2) : "0.00",
      }))
      .sort((a, b) => Number(b.adSpend) - Number(a.adSpend)),
    byOrder: orderRows.map(row => ({
      ...row,
      revenue: money(row.revenue),
      totalCost: money(row.totalCost),
      trueProfit: money(row.trueProfit),
    })),
    meta: {
      syncedInsights: insightRows.length,
      syncedCampaigns: campaignRows.length,
      impressions: insightRows.reduce((sum, row) => sum + row.impressions, 0),
      clicks: insightRows.reduce((sum, row) => sum + row.clicks, 0),
      purchases: insightRows.reduce((sum, row) => sum + row.purchases, 0),
      lastSyncedAt: accountRows.length
        ? ((
            await db
              .select({ lastSyncedAt: metaAdAccounts.lastSyncedAt })
              .from(metaAdAccounts)
              .where(eq(metaAdAccounts.storeId, storeId))
              .orderBy(desc(metaAdAccounts.lastSyncedAt))
              .limit(1)
          )[0]?.lastSyncedAt ?? null)
        : null,
    },
  };
}

function emptyReport() {
  return {
    totals: {
      revenue: "0.00",
      adSpend: "0.00",
      productCost: "0.00",
      packagingCost: "0.00",
      procurementDeliveryCost: "0.00",
      deliveryCost: "0.00",
      confirmationCost: "0.00",
      returnCost: "0.00",
      totalCost: "0.00",
      trueProfit: "0.00",
      profitMargin: "0.00%",
      cpa: "0.00",
      roas: "0.00",
    },
    counts: {
      deliveredOrders: 0,
      returnedOrders: 0,
      pendingOrders: 0,
      excludedOrders: 0,
    },
    byProduct: [],
    byCampaign: [],
    byOrder: [],
    meta: {
      syncedInsights: 0,
      syncedCampaigns: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      lastSyncedAt: null,
    },
  };
}
