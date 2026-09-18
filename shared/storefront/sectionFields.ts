/**
 * Editable fields per storefront section type (Phase 4 builder).
 * Only these keys are exposed in the contextual settings editor; values are
 * validated by the storefront config schema before saving.
 */
import type { StorefrontSectionType } from "./storefrontConfig";

export type SectionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "image"
  | "color"
  | "select";

export interface SectionFieldOption {
  value: string;
  label: string;
}

export interface SectionField {
  key: string;
  label: string;
  type: SectionFieldType;
  placeholder?: string;
  options?: SectionFieldOption[];
}

export const SECTION_LABELS: Record<StorefrontSectionType, string> = {
  announcement: "الإعلان",
  header: "الترويسة",
  hero: "Hero",
  categories: "الفئات",
  featured_products: "منتجات مميزة",
  product_grid: "شبكة المنتجات",
  promo: "بانر عرض",
  benefits: "المزايا",
  testimonials: "التقييمات",
  newsletter: "النشرة",
  footer: "التذييل",
};

export const SECTION_FIELDS: Record<StorefrontSectionType, SectionField[]> = {
  announcement: [{ key: "text", label: "نص الإعلان", type: "text" }],
  header: [
    { key: "showSearch", label: "إظهار البحث", type: "boolean" },
    { key: "showCart", label: "إظهار السلة", type: "boolean" },
    { key: "showAccount", label: "إظهار الحساب", type: "boolean" },
  ],
  hero: [
    { key: "eyebrow", label: "العنوان الصغير", type: "text" },
    { key: "title", label: "العنوان الرئيسي", type: "text" },
    { key: "subtitle", label: "الوصف", type: "textarea" },
    { key: "ctaLabel", label: "نص الزر", type: "text" },
    { key: "imageUrl", label: "صورة القسم", type: "image" },
  ],
  categories: [
    { key: "title", label: "العنوان", type: "text" },
    { key: "subtitle", label: "العنوان الفرعي", type: "text" },
  ],
  featured_products: [
    { key: "title", label: "العنوان", type: "text" },
    { key: "subtitle", label: "العنوان الفرعي", type: "text" },
    { key: "limit", label: "عدد المنتجات", type: "number" },
  ],
  product_grid: [
    { key: "title", label: "العنوان", type: "text" },
    { key: "subtitle", label: "العنوان الفرعي", type: "text" },
    { key: "limit", label: "عدد المنتجات", type: "number" },
  ],
  promo: [
    { key: "title", label: "العنوان", type: "text" },
    { key: "body", label: "النص", type: "textarea" },
    { key: "ctaLabel", label: "نص الزر", type: "text" },
  ],
  benefits: [{ key: "title", label: "العنوان", type: "text" }],
  testimonials: [],
  newsletter: [
    { key: "title", label: "العنوان", type: "text" },
    { key: "subtitle", label: "العنوان الفرعي", type: "text" },
    { key: "ctaLabel", label: "نص الزر", type: "text" },
  ],
  footer: [],
};

/** Section types a merchant can add from the builder. */
export const ADDABLE_SECTION_TYPES: StorefrontSectionType[] = [
  "hero",
  "product_grid",
  "featured_products",
  "categories",
  "promo",
  "benefits",
  "newsletter",
];

/** Styling override keys (cleared by "reset section styling"). */
export const SECTION_STYLE_KEYS = [
  "styleBg",
  "styleText",
  "styleFont",
  "stylePadY",
  "styleImage",
] as const;

/** Remove styling overrides from a section's settings (keeps content values). */
export function stripSectionStyle(
  settings: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const next: Record<string, string | number | boolean> = { ...settings };
  for (const key of SECTION_STYLE_KEYS) delete next[key];
  return next;
}

export const FONT_OPTIONS: SectionFieldOption[] = [
  { value: "cairo", label: "Cairo" },
  { value: "tajawal", label: "Tajawal" },
  { value: "rubik", label: "Rubik" },
];

/**
 * Common per-section style controls available on EVERY section (WordPress-like).
 * Applied to the section element itself by `SectionShell`, so they work across
 * all templates without duplicating styling code.
 */
export const COMMON_STYLE_FIELDS: SectionField[] = [
  { key: "styleImage", label: "صورة الخلفية", type: "image" },
  { key: "styleBg", label: "لون الخلفية", type: "color" },
  { key: "styleText", label: "لون النص", type: "color" },
  { key: "styleFont", label: "نوع الخط", type: "select", options: FONT_OPTIONS },
  { key: "stylePadY", label: "الحشوة الرأسية (px)", type: "number" },
];
