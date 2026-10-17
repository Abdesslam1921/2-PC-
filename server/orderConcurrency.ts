/**
 * Pure helpers for order-creation concurrency and inventory transitions.
 *
 * Kept free of DB imports so the rules (duplicate window, line signature,
 * order-number shape, confirmation/return status maps) are unit-testable.
 */

/** Double-submit window: same phone + same lines inside this window is a retry. */
export const ORDER_DUPLICATE_WINDOW_MS = 120_000;

export type OrderLineShape = {
  productId: number;
  variantId?: number | null;
  quantity: number;
  unitPrice: string;
};

/**
 * Deterministic line fingerprint. It includes the server-computed unit price
 * (which already encodes quantity offers/upsells) so two genuinely different
 * purchases are never collapsed, while line order does not matter.
 */
export function orderLineSignature(lines: OrderLineShape[]): string {
  return lines
    .map(line =>
      [
        line.productId,
        line.variantId ?? 0,
        line.quantity,
        String(line.unitPrice),
      ].join(":")
    )
    .sort()
    .join("|");
}

export function isDuplicateOrderWindow(
  createdAt: Date,
  now: Date = new Date(),
  windowMs: number = ORDER_DUPLICATE_WINDOW_MS
): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= windowMs;
}

/** Final public number derived from the auto-increment id (globally unique). */
export function orderNumberForId(orderId: number): string {
  return `ABD-${String(orderId).padStart(6, "0")}`;
}

/**
 * Stock is deducted on the FIRST transition to one of these statuses, or when
 * an order is created already in one of them (manual confirmed order). Orders
 * in `new`/`review`/`abandoned` never deduct.
 */
const DEDUCT_INVENTORY_STATUSES = new Set([
  "confirmed",
  "processing",
  "at_carrier",
  "shipped",
  "delivered",
]);

export function shouldDeductInventoryAtStatus(status: string): boolean {
  return DEDUCT_INVENTORY_STATUSES.has(status);
}

/** Statuses that mean the parcel physically left the merchant. */
const SHIPPED_OR_BEYOND_STATUSES = new Set([
  "at_carrier",
  "shipped",
  "delivered",
  "returned",
]);

export function isShippedOrBeyond(status: string): boolean {
  return SHIPPED_OR_BEYOND_STATUSES.has(status);
}

/**
 * Return always restores. Cancellation-like statuses restore only when the
 * order never left the merchant (checked by the DB helper); `delivered` never
 * restores.
 */
const RESTORE_INVENTORY_STATUSES = new Set([
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
  "abandoned",
]);

export function shouldRestoreInventory(status: string): boolean {
  return RESTORE_INVENTORY_STATUSES.has(status);
}
