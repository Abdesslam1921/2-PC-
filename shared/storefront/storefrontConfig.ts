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
export const STOREFRONT_TEMPLATE_KEYS = ["modern", "minimal", "bold"] as const;
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

export const storefrontSectionSchema = z.strictObject({
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
      id: "product_grid",
      type: "product_grid",
      enabled: true,
      order: 3,
      settings: { title: "المجموعة", subtitle: "", limit: 12 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 4,
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
      order: 5,
      settings: {},
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 6,
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
      order: 7,
      settings: {},
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
      settings: { text: "خصم يصل إلى 40% · توصيل 58 ولاية · الدفع عند الاستلام" },
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
      id: "product_grid",
      type: "product_grid",
      enabled: true,
      order: 3,
      settings: { title: "الأكثر مبيعًا", subtitle: "", limit: 8 },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 4,
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
      order: 5,
      settings: {},
    },
    {
      id: "newsletter",
      type: "newsletter",
      enabled: true,
      order: 6,
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
      order: 7,
      settings: {},
    },
  ],
};
