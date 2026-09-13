/**
 * Editable fields per storefront section type (Phase 4 builder).
 * Only these keys are exposed in the contextual settings editor; values are
 * validated by the storefront config schema before saving.
 */
import type { StorefrontSectionType } from "./storefrontConfig";

export type SectionFieldType = "text" | "textarea" | "number" | "boolean";

export interface SectionField {
  key: string;
  label: string;
  type: SectionFieldType;
  placeholder?: string;
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
  benefits: [],
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
