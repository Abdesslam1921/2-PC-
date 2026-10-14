/**
 * Pure cash-on-delivery pricing rules (no DB access).
 *
 * The public checkout (`orders.createCod`) must NEVER trust an amount sent by
 * the client: the unit price is always selected from DB-resolved values. These
 * helpers keep that decision testable in isolation.
 */

export type UpsellPricingConfig = {
  /** Fixed upsell price (takes priority when set). */
  upsellPrice?: string | null;
  /** Fixed amount taken off the upsell product's own price. */
  upsellDiscountAmount?: string | null;
  /** Percentage taken off the upsell product's own price. */
  upsellDiscountPercent?: number | null;
};

const MONEY = /^\d+(?:\.\d{1,2})?$/;

function toCents(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!MONEY.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Recompute an upsell line's unit price from the base product's stored upsell
 * settings and the upsell product's own DB price. Mirrors the storefront popup
 * (`CheckoutUpsellPopup.useUpsellOffer`). Returns null when no upsell pricing is
 * configured (the line must then be rejected).
 */
export function computeUpsellUnitPrice(
  config: UpsellPricingConfig,
  upsellProductPrice: string | null | undefined
): string | null {
  const listCents = toCents(upsellProductPrice) ?? 0;

  const fixedCents = toCents(config.upsellPrice);
  if (fixedCents != null && fixedCents > 0) return fromCents(fixedCents);

  const amountCents = toCents(config.upsellDiscountAmount);
  if (amountCents != null && amountCents > 0)
    return fromCents(Math.max(0, listCents - amountCents));

  const percent = config.upsellDiscountPercent ?? 0;
  if (percent > 0)
    return fromCents(Math.max(0, Math.round(listCents * (1 - percent / 100))));

  return null;
}

/**
 * Select a COD line's unit price from DB-resolved sources only. A quantity
 * offer's fixed price wins, then an upsell (already recomputed), then the
 * chosen variant, then the base product. There is deliberately no parameter for
 * a client-supplied price.
 */
export function selectCodUnitPrice(input: {
  quantityOfferPrice?: string | null;
  isUpsell: boolean;
  upsellPrice?: string | null;
  variantPrice?: string | null;
  productPrice?: string | null;
}): string | null {
  if (input.quantityOfferPrice) return input.quantityOfferPrice;
  if (input.isUpsell) return input.upsellPrice ?? null;
  return input.variantPrice ?? input.productPrice ?? null;
}

export type UpsellLineProduct = {
  productId: number;
  price: string | null;
  /** The product this line offers as its add-on (null when none). */
  upsellProductId: number | null;
  upsellPrice?: string | null;
  upsellDiscountAmount?: string | null;
  upsellDiscountPercent?: number | null;
};

/**
 * Resolve an upsell line's unit price, enforcing every server-side rule:
 *  - the line's product must be EXACTLY the `upsellProductId` configured on a
 *    base product that is part of the SAME order (so an upsell is only accepted
 *    when its base product is in the cart, in the same store — the caller has
 *    already forced one store for the whole order),
 *  - an upsell is a single add-on, so the quantity must be exactly 1,
 *  - the price is recomputed from the base's stored config + the line product's
 *    DB price (never from the client).
 * Returns null when any rule fails (the caller rejects the line).
 */
export function resolveUpsellLinePrice(input: {
  lineProductId: number;
  linePrice: string | null;
  quantity: number;
  orderProducts: UpsellLineProduct[];
}): string | null {
  if (input.quantity !== 1) return null;
  const base = input.orderProducts.find(
    candidate =>
      candidate.productId !== input.lineProductId &&
      candidate.upsellProductId === input.lineProductId
  );
  if (!base) return null;
  return computeUpsellUnitPrice(base, input.linePrice);
}
