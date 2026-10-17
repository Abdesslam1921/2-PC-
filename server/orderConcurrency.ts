/**
 * Pure helpers for order-creation concurrency.
 *
 * Kept free of DB imports so the rules (duplicate window, line signature,
 * order-number shape, inventory restoration map) are unit-testable.
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

/** Terminal, non-delivered statuses must give the reserved stock back. */
const RESTORE_INVENTORY_STATUSES = new Set([
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
  "abandoned",
]);

export function shouldRestoreInventory(fulfillmentStatus: string): boolean {
  return RESTORE_INVENTORY_STATUSES.has(fulfillmentStatus);
}

/** Statuses that reserve stock at creation and keep it reserved. */
export function shouldReserveInventoryAtCreation(input: {
  trackInventory: boolean;
  continueSelling: boolean;
}): boolean {
  return input.trackInventory && !input.continueSelling;
}
