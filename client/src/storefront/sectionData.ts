/**
 * Data helpers shared by the four templates so per-item editing (benefits,
 * categories) and the footer fields behave identically everywhere.
 *
 * Every value comes from the validated section config; templates only decide
 * how to render it.
 */
import type {
  StorefrontConfig,
  StorefrontSection,
} from "@shared/storefront/storefrontConfig";

export interface BenefitRow {
  id: string;
  num: string;
  title: string;
  text: string;
  icon: string;
  bg?: string;
}

/** Benefits: merchant items when present, otherwise the template's defaults. */
export function benefitRows(
  section: StorefrontSection,
  fallback: Array<[string, string, string]>
): BenefitRow[] {
  const items = section.items ?? [];
  if (items.length) {
    return items.map((item, index) => ({
      id: item.id,
      num: String(index + 1).padStart(2, "0"),
      title: item.name,
      text: item.text ?? "",
      icon: item.icon ?? "",
      bg: item.bg,
    }));
  }
  return fallback.map(([num, title, text], index) => ({
    id: `default-${index}`,
    num,
    title,
    text,
    icon: "",
    bg: undefined,
  }));
}

export interface CategoryTile {
  id: string;
  name: string;
  imageUrl?: string;
  bg?: string;
  /** Set when the tile comes from a real store category (links to its page). */
  slug?: string;
}

export interface PublicCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

/**
 * Category items that were SHIPPED by older template defaults.
 *
 * They were removed from the defaults, but older drafts and published
 * snapshots still carry them (immutable versions are never rewritten), which
 * made the four stock tiles flash for ~2s before the real categories loaded.
 * They are ignored at render time unless the merchant edited them (a different
 * name means it is no longer the untouched stock item).
 */
export const LEGACY_DEFAULT_CATEGORY_ITEMS: Record<string, string> = {
  "cat-clothes": "ملابس",
  "cat-accessories": "إكسسوارات",
  "cat-electronics": "إلكترونيات",
  "cat-beauty": "عناية",
};

export function isUntouchedLegacyCategoryItem(item: {
  id: string;
  name: string;
}): boolean {
  return LEGACY_DEFAULT_CATEGORY_ITEMS[item.id] === item.name.trim();
}

/** Drop the untouched stock items from a list of section items. */
export function stripLegacyDefaultCategoryItems<
  T extends { id: string; name: string },
>(items: T[]): T[] {
  return items.filter(item => !isUntouchedLegacyCategoryItem(item));
}

/**
 * Remove the untouched stock category tiles from a whole config (used when the
 * editor loads a draft so the stale defaults are cleaned, not republished).
 */
export function stripLegacyDefaultCategoriesFromConfig<T extends StorefrontConfig>(
  config: T
): T {
  let changed = false;
  const sections = config.sections.map(section => {
    if (section.type !== "categories" || !section.items?.length) return section;
    const items = stripLegacyDefaultCategoryItems(section.items);
    if (items.length === section.items.length) return section;
    changed = true;
    return { ...section, items: items.length ? items : undefined };
  });
  return changed ? ({ ...config, sections } as T) : config;
}

/**
 * Categories, in priority order:
 *   1. the store's REAL categories that have at least one active product
 *      (each links to /store/category/<slug>)
 *   2. merchant items for this section (custom tiles for stores without
 *      categories; searched in-page on click)
 *   3. live product collections (unchanged fallback behaviour)
 *
 * Real categories win because they are the store's source of truth: shipping
 * default items used to hide every category the merchant created.
 *
 * While the categories query is still loading the caller must render a
 * skeleton instead of calling this (otherwise the fallbacks flash on screen).
 */
export function categoryTiles(
  section: StorefrontSection,
  categories: PublicCategory[],
  collections: string[],
  /** While the categories query is in flight nothing else may be shown. */
  loading = false
): CategoryTile[] {
  if (loading) return [];
  if (categories.length) {
    return categories.map(category => ({
      id: String(category.id),
      name: category.name,
      imageUrl: category.imageUrl ?? undefined,
      slug: category.slug,
    }));
  }
  const items = stripLegacyDefaultCategoryItems(section.items ?? []);
  if (items.length) {
    return items.map(item => ({
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      bg: item.bg,
    }));
  }
  return collections.map(name => ({ id: name, name }));
}

export interface PublicOfferItem {
  productId: number;
  quantity: number;
  title: string;
  price: string | null;
  imageUrl?: string | null;
  /** Stock data, used to cap the cart line exactly like a normal add. */
  inventory?: number;
  trackInventory?: boolean;
  continueSelling?: boolean;
}

export interface PublicOffer {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  items: PublicOfferItem[];
  pricing: {
    originalTotal: number;
    discountAmount: number;
    bundlePrice: number;
    savingPercent: number;
    freeDelivery: boolean;
  };
}

export interface OfferCard {
  id: number;
  name: string;
  /** Bundle image, else the first product's image (approved fallback). */
  imageUrl?: string;
  items: PublicOfferItem[];
  originalTotal: number;
  bundlePrice: number;
  discountAmount: number;
  savingPercent: number;
  freeDelivery: boolean;
}
/** Cards shown by the storefront offers section (server already filtered). */
export function offerCards(offers: PublicOffer[]): OfferCard[] {
  return offers.map(offer => ({
    id: offer.id,
    name: offer.name,
    imageUrl: offer.imageUrl || offer.items[0]?.imageUrl || undefined,
    items: offer.items,
    originalTotal: offer.pricing.originalTotal,
    bundlePrice: offer.pricing.bundlePrice,
    discountAmount: offer.pricing.discountAmount,
    savingPercent: offer.pricing.savingPercent,
    freeDelivery: offer.pricing.freeDelivery,
  }));
}

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export interface FooterData {
  about: string;
  trackOrder: string;
  returns: string;
  phone: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  productsHref: string;
  categoriesHref: string;
  offersHref: string;
}

/** Footer content: editable help answers, contact number and social links. */
export function footerData(
  section: StorefrontSection,
  anchors: { products: string; categories: string; offers: string }
): FooterData {
  const s = section.settings;
  return {
    about: text(s.about),
    trackOrder: text(s.trackOrder),
    returns: text(s.returns),
    phone: text(s.phone),
    facebook: text(s.facebook),
    instagram: text(s.instagram),
    whatsapp: text(s.whatsapp),
    productsHref: anchors.products,
    categoriesHref: anchors.categories,
    offersHref: anchors.offers,
  };
}

/** Digits-only phone for wa.me / tel links. */
export function phoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function whatsappHref(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
