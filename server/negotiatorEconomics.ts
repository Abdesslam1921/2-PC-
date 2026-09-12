import { desc, eq, inArray } from "drizzle-orm";
import { storeOrderItems, storeOrders, storeProducts } from "../drizzle/schema";
import { getDb } from "./db";

const cents = (value: string | number | null | undefined) =>
  Math.round((Number(value ?? 0) || 0) * 100);
const money = (value: number) => (value / 100).toFixed(2);

type Accumulator = {
  productId: number;
  title: string;
  deliveredQty: number;
  returnedQty: number;
  deliveredOrders: number;
  returnedOrders: number;
  unitCostCents: number;
  deliveryCostCents: number;
  confirmationCostCents: number;
  adSpendCents: number;
  returnCostCents: number;
};

export async function getProductNegotiationEconomics(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.storeId, storeId))
    .orderBy(desc(storeOrders.createdAt));
  if (!orders.length) return [];

  const items = (
    await Promise.all(
      orders.map(order =>
        db
          .select()
          .from(storeOrderItems)
          .where(eq(storeOrderItems.orderId, order.id))
      )
    )
  ).flat();

  const byProduct = new Map<number, Accumulator>();
  const ensure = (productId: number, title: string) => {
    const existing = byProduct.get(productId);
    if (existing) return existing;
    const created: Accumulator = {
      productId,
      title,
      deliveredQty: 0,
      returnedQty: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      unitCostCents: 0,
      deliveryCostCents: 0,
      confirmationCostCents: 0,
      adSpendCents: 0,
      returnCostCents: 0,
    };
    byProduct.set(productId, created);
    return created;
  };

  for (const order of orders) {
    const isDelivered = order.fulfillmentStatus === "delivered";
    const isReturned = order.fulfillmentStatus === "returned";
    if (!isDelivered && !isReturned) continue;
    const orderItems = items.filter(item => item.orderId === order.id);
    if (!orderItems.length) continue;
    const lineBase = orderItems.reduce(
      (sum, item) => sum + cents(item.lineTotal),
      0
    );
    const adSpend = cents(order.adSpendAllocatedDzd);
    const deliveryCost = cents(order.deliveryCostSnapshot);
    for (const item of orderItems) {
      const acc = ensure(item.productId, item.title);
      const lineShare = lineBase
        ? cents(item.lineTotal) / lineBase
        : 1 / orderItems.length;
      const itemUnitCost =
        cents(item.productCostSnapshot) +
        cents(item.packagingCostSnapshot) +
        cents(item.procurementDeliveryCostSnapshot);
      if (isDelivered) {
        acc.deliveredQty += item.quantity;
        acc.deliveredOrders += 1;
        acc.unitCostCents += itemUnitCost * item.quantity;
        acc.deliveryCostCents += Math.round(deliveryCost * lineShare);
        acc.adSpendCents += Math.round(adSpend * lineShare);
        if (item.confirmationSource === "call_center") {
          acc.confirmationCostCents += cents(
            item.deliveredConfirmationCostSnapshot
          );
        }
      } else {
        acc.returnedQty += item.quantity;
        acc.returnedOrders += 1;
        if (!item.returnDeliveryFreeSnapshot) {
          acc.returnCostCents += cents(item.returnCostSnapshot);
        }
      }
    }
  }

  const productIds = Array.from(byProduct.keys());
  const productRows = productIds.length
    ? await db
        .select({
          id: storeProducts.id,
          title: storeProducts.title,
          price: storeProducts.price,
          compareAtPrice: storeProducts.compareAtPrice,
        })
        .from(storeProducts)
        .where(inArray(storeProducts.id, productIds))
    : [];
  const priceMap = new Map(productRows.map(row => [row.id, row]));

  return Array.from(byProduct.values())
    .map(acc => {
      const product = priceMap.get(acc.productId);
      const unitCost = acc.deliveredQty
        ? acc.unitCostCents / acc.deliveredQty
        : 0;
      const avgDeliveryCost = acc.deliveredOrders
        ? acc.deliveryCostCents / acc.deliveredOrders
        : 0;
      const avgConfirmationCost = acc.deliveredOrders
        ? acc.confirmationCostCents / acc.deliveredOrders
        : 0;
      const avgAdSpend = acc.deliveredOrders
        ? acc.adSpendCents / acc.deliveredOrders
        : 0;
      const avgReturnCost = acc.returnedOrders
        ? acc.returnCostCents / acc.returnedOrders
        : 0;
      const totalQty = acc.deliveredQty + acc.returnedQty;
      const returnRate = totalQty ? (acc.returnedQty / totalQty) * 100 : 0;
      const expectedReturnCost = (returnRate / 100) * avgReturnCost;
      const breakEvenPrice =
        unitCost +
        avgDeliveryCost +
        avgConfirmationCost +
        avgAdSpend +
        expectedReturnCost;
      return {
        productId: acc.productId,
        title: product?.title ?? acc.title,
        price: product?.price ?? null,
        compareAtPrice: product?.compareAtPrice ?? null,
        unitCost: money(unitCost),
        avgDeliveryCost: money(avgDeliveryCost),
        avgConfirmationCost: money(avgConfirmationCost),
        avgAdSpend: money(avgAdSpend),
        avgReturnCost: money(avgReturnCost),
        returnRate: `${returnRate.toFixed(2)}%`,
        breakEvenPrice: money(breakEvenPrice),
      };
    })
    .sort((a, b) => Number(a.unitCost) - Number(b.unitCost));
}
