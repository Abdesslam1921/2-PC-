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
  /**
   * Conditional visibility: the field is only relevant when another setting has
   * one of these values (e.g. the gradient stops only when the background type
   * is "gradient"). Applied generically by `visibleSectionFields`.
   */
  showWhen?: { key: string; in: Array<string | number | boolean> };
  /** Section types where this field must not be shown (avoids duplicates). */
  hideFor?: StorefrontSectionType[];
  /**
   * Keys to clear together with this field when it is reset to its default.
   * Used by dependent choices: returning "نوع الخلفية" to the template default
   * must also drop the stored color/gradient, otherwise the old value keeps
   * painting the section.
   */
  onClearAlso?: string[];
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
  signature: "التوقيع",
  footer: "التذييل",
};

export function visibleSectionFields(
  sectionType: StorefrontSectionType,
  fields: SectionField[],
  settings: Record<string, string | number | boolean>
): SectionField[] {
  return fields.filter(field => {
    if (field.hideFor?.includes(sectionType)) return false;
    if (field.showWhen) {
      const current = settings[field.showWhen.key];
      return field.showWhen.in.includes(current ?? "");
    }
    return true;
  });
}

export const FONT_OPTIONS: SectionFieldOption[] = [
  { value: "cairo", label: "Cairo" },
  { value: "tajawal", label: "Tajawal" },
  { value: "rubik", label: "Rubik" },
];

/** Approved icon keys for item cards (mapped to real icons on the client). */
export const ICON_OPTIONS: SectionFieldOption[] = [
  { value: "truck", label: "شاحنة (توصيل)" },
  { value: "banknote", label: "نقود (دفع)" },
  { value: "shield", label: "درع (حماية)" },
  { value: "return", label: "إرجاع" },
  { value: "phone", label: "هاتف" },
  { value: "star", label: "نجمة" },
  { value: "heart", label: "قلب" },
  { value: "gift", label: "هدية" },
  { value: "check", label: "علامة صح" },
  { value: "clock", label: "ساعة" },
  { value: "sparkles", label: "لمعان" },
];

export const SECTION_FIELDS: Record<StorefrontSectionType, SectionField[]> = {
  announcement: [
    { key: "text", label: "نص الإعلان", type: "text" },
    { key: "subtitle", label: "النص الثانوي", type: "text" },
  ],
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
  signature: [
    { key: "text", label: "نص التوقيع", type: "text" },
    { key: "subtitle", label: "السطر الثاني", type: "text" },
    {
      key: "font",
      label: "نوع الخط",
      type: "select",
      options: [
        { value: "greatvibes", label: "Great Vibes (خط توقيع)" },
        ...FONT_OPTIONS,
        { value: "serif", label: "Serif (كلاسيكي)" },
        { value: "mono", label: "Mono (تقني)" },
      ],
    },
    { key: "color", label: "لون التوقيع", type: "color" },
    { key: "showOrnament", label: "إظهار الزخرفة", type: "boolean" },
  ],
  footer: [
    { key: "about", label: "وصف المتجر", type: "textarea" },
    { key: "trackOrder", label: "جواب «تتبع الطلب»", type: "textarea" },
    { key: "returns", label: "جواب «سياسة الإرجاع»", type: "textarea" },
    { key: "phone", label: "رقم الهاتف", type: "text" },
    { key: "facebook", label: "رابط فيسبوك", type: "text" },
    { key: "instagram", label: "رابط إنستغرام", type: "text" },
    { key: "whatsapp", label: "رقم واتساب", type: "text" },
  ],
};

/**
 * Repeatable items editor per section type. Items are validated by the same
 * strict schema, so a merchant can edit each tile/card individually.
 */
export const SECTION_ITEM_FIELDS: Partial<
  Record<StorefrontSectionType, SectionField[]>
> = {
  categories: [
    { key: "name", label: "اسم الفئة", type: "text" },
    { key: "imageUrl", label: "صورة الفئة", type: "image" },
    { key: "bg", label: "لون خلفية الفئة", type: "color" },
  ],
  benefits: [
    { key: "name", label: "النص الأساسي", type: "text" },
    { key: "text", label: "النص الثانوي", type: "text" },
    { key: "icon", label: "الأيقونة", type: "select", options: ICON_OPTIONS },
    { key: "bg", label: "لون خلفية البطاقة", type: "color" },
  ],
};

/** Label of the "add item" button per section type. */
export const SECTION_ITEM_LABELS: Partial<Record<StorefrontSectionType, string>> = {
  categories: "الفئات المخصّصة",
  benefits: "عناصر المزايا",
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
  "signature",
];

/** Styling override keys (cleared by "reset section styling"). */
export const SECTION_STYLE_KEYS = [
  "styleBgMode",
  "styleBg",
  "styleGradientFrom",
  "styleGradientTo",
  "styleGradientAngle",
  "styleText",
  "styleTextMuted",
  "styleFont",
  "styleBorderColor",
  "styleBorderWidth",
  "styleRadius",
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

/**
 * Common per-section overrides available on EVERY section.
 *
 * These are OVERRIDES of the global theme for one section only (background
 * solid/gradient, text + muted text colors, font, borders, radius, padding and
 * background image). Empty value = follow the theme/template default.
 */
export const COMMON_STYLE_FIELDS: SectionField[] = [
  {
    key: "styleBgMode",
    label: "نوع الخلفية",
    type: "select",
    // No "" option here: the panel renders the single "افتراضي القالب" option
    // itself, so it can never appear twice.
    options: [
      { value: "solid", label: "لون صلب" },
      { value: "gradient", label: "تدرّج" },
    ],
    // Going back to the template default drops the stored background values.
    onClearAlso: [
      "styleBg",
      "styleGradientFrom",
      "styleGradientTo",
      "styleGradientAngle",
    ],
  },
  { key: "styleBg", label: "لون الخلفية", type: "color", showWhen: { key: "styleBgMode", in: ["", "solid"] } },
  {
    key: "styleGradientFrom",
    label: "التدرّج — من",
    type: "color",
    showWhen: { key: "styleBgMode", in: ["gradient"] },
  },
  {
    key: "styleGradientTo",
    label: "التدرّج — إلى",
    type: "color",
    showWhen: { key: "styleBgMode", in: ["gradient"] },
  },
  {
    key: "styleGradientAngle",
    label: "زاوية التدرّج (درجة)",
    type: "number",
    showWhen: { key: "styleBgMode", in: ["gradient"] },
  },
  { key: "styleImage", label: "صورة الخلفية", type: "image" },
  { key: "styleText", label: "لون النص", type: "color" },
  { key: "styleTextMuted", label: "لون النص الباهت", type: "color" },
  {
    key: "styleFont",
    label: "نوع الخط",
    type: "select",
    options: FONT_OPTIONS,
    // The signature has its own "font" field (Great Vibes, serif, …): hide the
    // common one there so a section never shows two font pickers.
    hideFor: ["signature"],
  },
  { key: "styleBorderColor", label: "لون الحدود", type: "color" },
  { key: "styleBorderWidth", label: "سماكة الحدود (px)", type: "number" },
  { key: "styleRadius", label: "انحناء الحواف (px)", type: "number" },
  { key: "stylePadY", label: "الحشوة الرأسية (px)", type: "number" },
];

/** Panel grouping for the common overrides (order matters). */
export const COMMON_STYLE_GROUPS: Array<{ label: string; keys: string[] }> = [  {
    label: "خلفية القسم",
    keys: [
      "styleBgMode",
      "styleBg",
      "styleGradientFrom",
      "styleGradientTo",
      "styleGradientAngle",
      "styleImage",
    ],
  },
  { label: "النص والخط", keys: ["styleText", "styleTextMuted", "styleFont"] },
  {
    label: "الحدود والحواف",
    keys: ["styleBorderColor", "styleBorderWidth", "styleRadius"],
  },
  { label: "الحشوة", keys: ["stylePadY"] },
];
