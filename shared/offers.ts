/**
 * Offer (bundle) pricing + availability — one source of truth shared by the
 * server (checkout/validation) and the dashboard/storefront UI.
 *
 * There is never a manual bundle price: it is always the sum of the products'
 * prices minus the discount.
 */

export type OfferDiscountType = "percent" | "amount";

export type OfferKind = "bundle" | "quantity";

export interface OfferLike {
  isActive: boolean;
  /** "bundle" = several products + discount, "quantity" = legacy single-product deal. */
  kind?: OfferKind;
  /** Quantity deals only: the fixed total price for that quantity. */
  fixedPrice?: string | number | null;
  /** Quantity deals only (0 = unlimited). */
  maxUses?: number;
  usedCount?: number;
  discountType: OfferDiscountType | null;
  discountValue: string | number | null;
  freeDelivery: boolean;
}

export interface OfferItemLike {
  quantity: number;
  price: string | number | null;
  title?: string;
  status?: "draft" | "active";
  /** Digital products use a different checkout flow → not allowed in bundles. */
  productKind?: "physical" | "digital";
  inventory?: number;
  trackInventory?: boolean;
  continueSelling?: boolean;
}

export interface OfferPricing {
  originalTotal: number;
  discountAmount: number;
  bundlePrice: number;
  savingPercent: number;
  freeDelivery: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Percent discounts are capped at 95% so a bundle can never be free. */
export const MAX_DISCOUNT_PERCENT = 95;
export const MIN_OFFER_ITEMS = 2;
export const MAX_OFFER_ITEMS = 20;

export function computeOfferPricing(
  offer: Pick<
    OfferLike,
    "kind" | "fixedPrice" | "discountType" | "discountValue" | "freeDelivery"
  >,
  items: Array<Pick<OfferItemLike, "quantity" | "price">>
): OfferPricing {
  const originalTotal = items.reduce(
    (sum, item) => sum + Number(item.price ?? 0) * item.quantity,
    0
  );

  /**
   * Quantity deals keep the legacy behaviour: the merchant sets the TOTAL price
   * for that quantity, so the "discount" is whatever the products' sum exceeds
   * that price by.
   */
  if (offer.kind === "quantity" && offer.fixedPrice != null) {
    const price = Math.max(Number(offer.fixedPrice) || 0, 0);
    const discountAmount = Math.max(originalTotal - price, 0);
    return {
      originalTotal: round2(originalTotal),
      discountAmount: round2(discountAmount),
      bundlePrice: round2(price),
      savingPercent:
        originalTotal > 0 ? round2((discountAmount / originalTotal) * 100) : 0,
      freeDelivery: offer.freeDelivery,
    };
  }

  const value = Number(offer.discountValue ?? 0);
  const discountAmount =
    offer.discountType === "percent"
      ? (originalTotal * Math.min(Math.max(value, 0), MAX_DISCOUNT_PERCENT)) / 100
      : offer.discountType === "amount"
        ? Math.max(value, 0)
        : 0;
  return {
    originalTotal: round2(originalTotal),
    discountAmount: round2(discountAmount),
    bundlePrice: round2(originalTotal - discountAmount),
    savingPercent:
      originalTotal > 0 ? round2((discountAmount / originalTotal) * 100) : 0,
    freeDelivery: offer.freeDelivery,
  };
}

/**
 * Why an offer cannot be sold right now (null = available).
 *
 * Used for the storefront (a failing offer disappears completely, fail-closed),
 * for the cart button and again at checkout.
 */
export function offerUnavailableReason(
  offer: Pick<OfferLike, "isActive" | "kind" | "fixedPrice" | "maxUses" | "usedCount">,
  items: OfferItemLike[],
  pricing: OfferPricing
): string | null {
  if (!offer.isActive) return "العرض معطّل.";

  /** Quantity deals: one product, its own availability rules (legacy). */
  if (offer.kind === "quantity") {
    if (items.length !== 1) return "عرض الكمية يحتاج منتجًا واحدًا.";
    const item = items[0];
    const title = item.title ?? "منتج";
    if (item.productKind === "digital") {
      return `المنتج «${title}» رقمي - لا يمكن إضافته إلى عرض.`;
    }
    if (item.status && item.status !== "active") {
      return `المنتج «${title}» غير منشور.`;
    }
    const outOfStock =
      Boolean(item.trackInventory) &&
      !item.continueSelling &&
      Number(item.inventory ?? 0) < item.quantity;
    if (outOfStock) return `المنتج «${title}» غير متوفر بالكمية المطلوبة.`;
    const maxUses = offer.maxUses ?? 0;
    if (maxUses > 0 && (offer.usedCount ?? 0) >= maxUses) {
      return "انتهى عدد مرات استعمال هذا العرض.";
    }
    if (pricing.bundlePrice <= 0) return "سعر العرض غير صالح.";
    return null;
  }

  if (items.length < MIN_OFFER_ITEMS) {
    return `العرض يحتاج ${MIN_OFFER_ITEMS} منتجات على الأقل.`;
  }
  if (items.length > MAX_OFFER_ITEMS) {
    return `عدد منتجات العرض يتجاوز ${MAX_OFFER_ITEMS}.`;
  }
  for (const item of items) {
    const title = item.title ?? "منتج";
    if (item.productKind === "digital") {
      return `المنتج «${title}» رقمي — لا يمكن إضافته إلى عرض.`;
    }
    if (item.status && item.status !== "active") {
      return `المنتج «${title}» غير منشور.`;
    }
    const outOfStock =
      Boolean(item.trackInventory) &&
      !item.continueSelling &&
      Number(item.inventory ?? 0) < item.quantity;
    if (outOfStock) return `المنتج «${title}» غير متوفر بالكمية المطلوبة.`;
  }
  if (pricing.originalTotal <= 0) return "مجموع أسعار منتجات العرض صفر.";
  if (pricing.bundlePrice <= 0) {
    return "الخصم يساوي أو يتجاوز مجموع الأسعار — صحّح الخصم أو الأسعار.";
  }
  return null;
}
