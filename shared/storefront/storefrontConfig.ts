/**
 * Storefront template configuration contract (Phase 3).
 *
 * Structured, validated data only — no executable CSS/JS. Section settings are
 * safe primitives with a fixed key pattern. The active template is chosen by
 * `templateKey`; only its code is rendered on the storefront.
 */
import { z } from "zod";
import { storefrontThemeConfigSchema } from "./themeSchema";

/** Templates supported by the engine. Extend as new templates are approved. */
export const STOREFRONT_TEMPLATE_KEYS = [
  "modern",
  "minimal",
  "bold",
  "boutique",
] as const;
export type StorefrontTemplateKey = (typeof STOREFRONT_TEMPLATE_KEYS)[number];

export const STOREFRONT_SECTION_TYPES = [
  "announcement",
  "header",
  "hero",
  "categories",
  "featured_products",
  "product_grid",
  "promo",
  "benefits",
  "testimonials",
  "newsletter",
  "signature",
  "footer",
] as const;
export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

const UNSAFE = /[;<>{}\\<>]|url\s*\(|expression\s*\(|@import|javascript:/i;
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(v => !UNSAFE.test(v), "قيمة غير آمنة");
const SETTING_KEY = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;

const COLOR_VALUE =
  /^(#[0-9a-fA-F]{3,8}|oklch\([^()]*\)|rgba?\([^()]*\)|hsla?\([^()]*\)|transparent|currentColor)$/;
const LENGTH_VALUE = /^\d{1,4}(\.\d+)?(px|deg)?$/;

/**
 * Per-section override keys and the shape each value must have. Values are safe
 * primitives (never free CSS) and anything unrecognised is rejected, so a
 * merchant can restyle a section without ever injecting arbitrary CSS.
 */
const SECTION_STYLE_VALUE_RULES: Record<
  string,
  "color" | "length" | "angle" | "enum"
> = {
  styleBg: "color",
  styleGradientFrom: "color",
  styleGradientTo: "color",
  styleText: "color",
  styleTextMuted: "color",
  styleBorderColor: "color",
  styleGradientAngle: "angle",
  styleBorderWidth: "length",
  styleRadius: "length",
  stylePadY: "length",
};
const STYLE_ENUM_VALUES: Record<string, string[]> = {
  styleBgMode: ["", "solid", "gradient"],
  styleFont: ["", "greatvibes", "cairo", "tajawal", "rubik"],
};

function isValidStyleValue(key: string, value: unknown): boolean {
  const rule = SECTION_STYLE_VALUE_RULES[key];
  if (rule === "color") return typeof value === "string" && COLOR_VALUE.test(value.trim());
  if (rule === "length" || rule === "angle") {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0;
    return typeof value === "string" && LENGTH_VALUE.test(value.trim());
  }
  const allowed = STYLE_ENUM_VALUES[key];
  if (allowed) return typeof value === "string" && allowed.includes(value);
  return true;
}

/** Repeatable section item (category tiles, benefit cards, ...). */
export const storefrontSectionItemSchema = z.strictObject({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "معرّف عنصر غير صالح"),
  /** Primary text: category name / benefit title. */
  name: safeText(120),
  imageUrl: safeText(600).optional(),
  /** Secondary text (benefit description). */
  text: safeText(300).optional(),
  /** Background color of the item (category tile / benefit card). */
  bg: safeText(120).optional(),
  /** Icon key from the approved icon list. */
  icon: safeText(40).optional(),
});
export type StorefrontSectionItem = z.infer<typeof storefrontSectionItemSchema>;

export const storefrontSectionSchema = z
  .strictObject({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "معرّف قسم غير صالح"),
    type: z.enum(STOREFRONT_SECTION_TYPES),
    enabled: z.boolean(),
    order: z.number().int().min(0).max(999),
    settings: z.record(
      z.string().regex(SETTING_KEY, "مفتاح إعداد غير صالح"),
      z.union([safeText(600), z.number().finite(), z.boolean()])
    ),
    /** Optional repeatable items (used by the Categories section). */
    items: z.array(storefrontSectionItemSchema).max(24).optional(),
  })
  .superRefine((section, ctx) => {
    for (const [key, value] of Object.entries(section.settings)) {
      if (!isValidStyleValue(key, value)) {
        ctx.addIssue({
          code: "custom",
          path: ["settings", key],
          message: `قيمة التنسيق غير صالحة للحقل ${key}.`,
        });
      }
    }
  });

export type StorefrontSection = z.infer<typeof storefrontSectionSchema>;

export const storefrontConfigSchema = z.strictObject({
  templateKey: z.enum(STOREFRONT_TEMPLATE_KEYS),
  theme: storefrontThemeConfigSchema.optional(),
  sections: z.array(storefrontSectionSchema).max(60),
});

export type StorefrontConfig = z.infer<typeof storefrontConfigSchema>;

export interface StorefrontValidationResult {
  ok: boolean;
  data?: StorefrontConfig;
  message?: string;
}

/** Validate (never throw) so a bad draft/version falls back safely. */
export function validateStorefrontConfig(
  input: unknown
): StorefrontValidationResult {
  const res = storefrontConfigSchema.safeParse(input);
  if (res.success) return { ok: true, data: res.data };
  return { ok: false, message: res.error.issues[0]?.message ?? "إعداد غير صالح." };
}

/** Default Modern configuration — the one-click opt-in starting point. */
export const DEFAULT_MODERN_CONFIG: StorefrontConfig = {
  templateKey: "modern",
  theme: {},
  sections: [
    {
      id: "announcement",
      type: "announcement",
      enabled: true,
      order: 0,
      settings: {
        text: "توصيل لكل الولايات · الدفع عند الاستلام · إرجاع خلال 7 أيام",
        subtitle: "اطلب اليوم واستلم قريبًا",
      },
    },
    {
      id: "header",
      type: "header",
      enabled: true,
      order: 1,
      settings: { showSearch: true, showCart: true, showAccount: true },
    },
    {
      id: "hero",
      type: "hero",
      enabled: true,
      order: 2,
      settings: {
        eyebrow: "وصل حديثًا",
        title: "أناقة عملية لكل يوم",
        subtitle:
          "تشكيلة مختارة بعناية، بأسعار مدروسة وتوصيل سريع إلى باب منزلك.",
        ctaLabel: "تسوق الآن",
      },
    },
    {
      id: "categories",
      type: "categories",
      enabled: true,
      order: 3,
      settings: { title: "تسوق حسب الفئة", subtitle: "اختر ما يناسبك من مجموعاتنا" },
    },
    {
      id: "featured_products",
      type: "featured_products",
      enabled: true,
      order: 4,
      settings: { title: "منتجات مميزة", subtitle: "الأكثر طلبًا", limit: 8 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 5,
      settings: {
        title: "عرض الأسبوع: حتى 30% على المختارات",
        body: "لفترة محدودة — اكتشف القطع المميزة قبل نهاية العرض.",
        ctaLabel: "اكتشف العرض",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      enabled: true,
      order: 6,
      settings: {},
      items: [
        { id: "benefit-delivery", name: "توصيل سريع", text: "لجميع الولايات.", icon: "truck" },
        { id: "benefit-cod", name: "دفع عند الاستلام", text: "افحص قبل الدفع.", icon: "banknote" },
        { id: "benefit-returns", name: "إرجاع 7 أيام", text: "استرجاع سهل.", icon: "return" },
        { id: "benefit-safe", name: "دفع آمن", text: "بياناتك محمية.", icon: "shield" },
      ],
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 7,
      settings: {
        title: "انضم إلى نشرتنا البريدية",
        subtitle: "عروض حصرية وتنبيهات المنتجات الجديدة.",
        ctaLabel: "اشترك",
      },
    },
    {
      id: "footer",
      type: "footer",
      enabled: true,
      order: 8,
      settings: {},
    },
    {
      id: "signature",
      type: "signature",
      enabled: true,
      order: 9,
      settings: { text: "", subtitle: "", font: "greatvibes" },
    },
  ],
};

/**
 * Default Minimal configuration — text-led hero, spacious rhythm, borderless
 * product grid, thin header and single-line footer. Structurally distinct from
 * Modern (not just a color change).
 */
export const DEFAULT_MINIMAL_CONFIG: StorefrontConfig = {
  templateKey: "minimal",
  theme: {},
  sections: [
    {
      id: "announcement",
      type: "announcement",
      enabled: true,
      order: 0,
      settings: {
        text: "توصيل لكل الولايات · الدفع عند الاستلام · إرجاع خلال 7 أيام",
        subtitle: "اطلب اليوم واستلم قريبًا",
      },
    },
    {
      id: "header",
      type: "header",
      enabled: true,
      order: 1,
      settings: { showSearch: false, showCart: true, showAccount: false },
    },
    {
      id: "hero",
      type: "hero",
      enabled: true,
      order: 2,
      settings: {
        eyebrow: "مجموعة 2026",
        title: "أساسيات مدروسة، بلا ضجيج.",
        subtitle:
          "قطع تُصمَّم لتبقى: خامات متينة، خطوط هادئة، وأسعار واضحة. تجربة شراء بلا تعقيد — من التصفح إلى باب منزلك.",
        ctaLabel: "تسوق المجموعة",
      },
    },
    {
      id: "categories",
      type: "categories",
      enabled: true,
      order: 3,
      settings: { title: "تسوق حسب الفئة", subtitle: "اختر ما يناسبك من مجموعاتنا" },
    },
    {
      id: "product_grid",
      type: "product_grid",
      enabled: true,
      order: 4,
      settings: { title: "المجموعة", subtitle: "", limit: 12 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 5,
      settings: {
        title: "خصم حتى 30% على مختارات الموسم",
        body: "تخفيضات هادئة على قطع مختارة — بلا فوضى، وبلا عدّاد ضغط.",
        ctaLabel: "اكتشف العرض",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      enabled: true,
      order: 6,
      settings: {},
      items: [
        { id: "benefit-delivery", name: "توصيل سريع", text: "لجميع الولايات خلال 48–72 ساعة.", icon: "truck" },
        { id: "benefit-cod", name: "دفع عند الاستلام", text: "افحص طلبك قبل الدفع.", icon: "banknote" },
        { id: "benefit-returns", name: "إرجاع خلال 7 أيام", text: "استرجاع بسيط بلا تعقيد.", icon: "return" },
        { id: "benefit-safe", name: "دفع آمن", text: "بياناتك محمية دائمًا.", icon: "shield" },
      ],
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 7,
      settings: {
        title: "رسائل قليلة، بلا إزعاج.",
        subtitle: "إشعار واحد عند إصدار مجموعة جديدة.",
        ctaLabel: "اشترك",
      },
    },
    {
      id: "footer",
      type: "footer",
      enabled: true,
      order: 8,
      settings: {},
    },
    {
      id: "signature",
      type: "signature",
      enabled: true,
      order: 9,
      settings: { text: "", subtitle: "", font: "greatvibes" },
    },
  ],
};

/**
 * Default Bold configuration — compact rhythm, thick borders, dark full-bleed
 * hero with oversized type, high-density two-column product cards.
 */
export const DEFAULT_BOLD_CONFIG: StorefrontConfig = {
  templateKey: "bold",
  theme: {},
  sections: [
    {
      id: "announcement",
      type: "announcement",
      enabled: true,
      order: 0,
      settings: {
        text: "خصم يصل إلى 40% · توصيل 58 ولاية · الدفع عند الاستلام",
        subtitle: "اطلب اليوم واستلم قريبًا",
      },
    },
    {
      id: "header",
      type: "header",
      enabled: true,
      order: 1,
      settings: { showSearch: false, showCart: true, showAccount: false },
    },
    {
      id: "hero",
      type: "hero",
      enabled: true,
      order: 2,
      settings: {
        eyebrow: "عرض الأسبوع",
        title: "قوّتك في التفاصيل. تسوّق بجرأة.",
        subtitle:
          "قطع عالية الجودة بأسعار تنافسية — تصاميم جسورة، خامات متينة، وتوصيل سريع لكل الولايات.",
        ctaLabel: "تسوق المجموعة",
      },
    },
    {
      id: "categories",
      type: "categories",
      enabled: true,
      order: 3,
      settings: { title: "تسوق حسب الفئة", subtitle: "اختر ما يناسبك من مجموعاتنا" },
    },
    {
      id: "product_grid",
      type: "product_grid",
      enabled: true,
      order: 4,
      settings: { title: "الأكثر مبيعًا", subtitle: "", limit: 8 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 5,
      settings: {
        title: "يبدأ العرض الآن.",
        body: "حتى 40% على مختارات كاملة — الكمية محدودة، والطلب أسرع من الأمس.",
        ctaLabel: "اكتشف العروض",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      enabled: true,
      order: 6,
      settings: {},
      items: [
        { id: "benefit-delivery", name: "توصيل 58 ولاية", text: "خلال 48–72 ساعة", icon: "truck" },
        { id: "benefit-cod", name: "دفع عند الاستلام", text: "افحص قبل الدفع", icon: "banknote" },
        { id: "benefit-returns", name: "إرجاع 7 أيام", text: "استرجاع سهل", icon: "return" },
        { id: "benefit-safe", name: "دفع آمن", text: "بيانات محمية", icon: "shield" },
      ],
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 7,
      settings: {
        title: "لا تفوّت العروض.",
        subtitle: "اشترك ليصلك كل جديد وأقوى التخفيضات أولًا بأول.",
        ctaLabel: "اشترك",
      },
    },
    {
      id: "footer",
      type: "footer",
      enabled: true,
      order: 8,
      settings: {},
    },
    {
      id: "signature",
      type: "signature",
      enabled: true,
      order: 9,
      settings: { text: "", subtitle: "", font: "greatvibes" },
    },
  ],
};

/**
 * Default Boutique configuration — warm cream + gold, split (text + framed
 * image) hero, elegant three-column framed cards.
 */
export const DEFAULT_BOUTIQUE_CONFIG: StorefrontConfig = {
  templateKey: "boutique",
  theme: {},
  sections: [
    {
      id: "announcement",
      type: "announcement",
      enabled: true,
      order: 0,
      settings: {
        text: "توصيل لكل الولايات ✦ الدفع عند الاستلام ✦ إرجاع خلال 7 أيام",
        subtitle: "اطلب اليوم واستلم قريبًا",
      },
    },
    {
      id: "header",
      type: "header",
      enabled: true,
      order: 1,
      settings: { showSearch: false, showCart: true, showAccount: false },
    },
    {
      id: "hero",
      type: "hero",
      enabled: true,
      order: 2,
      settings: {
        eyebrow: "مجموعة الفخامة",
        title: "تفاصيل تُروى بصمت.",
        subtitle:
          "قطع مختارة بعناية لمن يقدّر الهدوء والأناقة. خامات راقية، تشطيبات دقيقة، وتغليف يصنع اللحظة.",
        ctaLabel: "اكتشف المجموعة",
      },
    },
    {
      id: "categories",
      type: "categories",
      enabled: true,
      order: 3,
      settings: { title: "تسوق حسب الفئة", subtitle: "اختر ما يناسبك من مجموعاتنا" },
    },
    {
      id: "product_grid",
      type: "product_grid",
      enabled: true,
      order: 4,
      settings: { title: "قطع مختارة بعناية", subtitle: "المجموعة", limit: 9 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 5,
      settings: {
        title: "تغليف فاخر مجانًا لكل طلب",
        body: "نُرفق بطاقة مكتوبة بخط اليد مع كل قطعة مختارة — لأن الهدية تبدأ من التفاصيل.",
        ctaLabel: "اطلب الآن",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      enabled: true,
      order: 6,
      settings: {},
      items: [
        { id: "benefit-delivery", name: "توصيل فاخر", text: "تغليف أنيق لكل الولايات.", icon: "truck" },
        { id: "benefit-cod", name: "دفع عند الاستلام", text: "افحص طلبك قبل الدفع.", icon: "banknote" },
        { id: "benefit-returns", name: "إرجاع خلال 7 أيام", text: "استرجاع هادئ بلا تعقيد.", icon: "return" },
        { id: "benefit-original", name: "خامات أصلية", text: "مصادر موثوقة وضمان جودة.", icon: "shield" },
      ],
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 7,
      settings: {
        title: "رسائل راقية فقط",
        subtitle: "إشعار واحد عند إصدار مجموعة جديدة.",
        ctaLabel: "اشترك",
      },
    },
    {
      id: "footer",
      type: "footer",
      enabled: true,
      order: 8,
      settings: {},
    },
    {
      id: "signature",
      type: "signature",
      enabled: true,
      order: 9,
      settings: { text: "", subtitle: "", font: "greatvibes" },
    },
  ],
};

/** Canonical default config per approved template. */
export const TEMPLATE_DEFAULT_CONFIGS: Record<string, StorefrontConfig> = {
  modern: DEFAULT_MODERN_CONFIG,
  minimal: DEFAULT_MINIMAL_CONFIG,
  bold: DEFAULT_BOLD_CONFIG,
  boutique: DEFAULT_BOUTIQUE_CONFIG,
};

/** Default config of a template, or null for an unknown/legacy key. */
export function templateDefaultConfig(
  templateKey: string | null | undefined
): StorefrontConfig | null {
  if (!templateKey) return null;
  return TEMPLATE_DEFAULT_CONFIGS[templateKey] ?? null;
}

/** Default section of a template matching a section id (or its type). */
export function templateDefaultSection(
  templateKey: string | null | undefined,
  section: { id: string; type: string }
): StorefrontSection | null {
  const config = templateDefaultConfig(templateKey);
  if (!config) return null;
  return (
    config.sections.find(s => s.id === section.id) ??
    config.sections.find(s => s.type === section.type) ??
    null
  );
}
