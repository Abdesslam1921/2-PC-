/**
 * Data helpers shared by the four templates so per-item editing (benefits,
 * categories) and the footer fields behave identically everywhere.
 *
 * Every value comes from the validated section config; templates only decide
 * how to render it.
 */
import type { StorefrontSection } from "@shared/storefront/storefrontConfig";

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
 * Categories, in priority order:
 *   1. merchant items for this section (name/image/color, searched on click)
 *   2. the store's real categories (each links to /store/category/<slug>)
 *   3. live product collections (unchanged fallback behaviour)
 */
export function categoryTiles(
  section: StorefrontSection,
  categories: PublicCategory[],
  collections: string[]
): CategoryTile[] {
  const items = section.items ?? [];
  if (items.length) {
    return items.map(item => ({
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      bg: item.bg,
    }));
  }
  if (categories.length) {
    return categories.map(category => ({
      id: String(category.id),
      name: category.name,
      imageUrl: category.imageUrl ?? undefined,
      slug: category.slug,
    }));
  }
  return collections.map(name => ({ id: name, name }));
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
}

/** Footer content: editable help answers, contact number and social links. */
export function footerData(
  section: StorefrontSection,
  anchors: { products: string; categories: string }
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
