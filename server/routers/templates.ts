import { z } from "zod";
import { getStoreThemeSettings, saveStoreThemeSettings } from "../db";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { getStoreId } from "../_core/trpc";

// ===== 4 قوالب برو حقيقية - مشي غير لون =====
export const TEMPLATE_PRESETS = [
  {
    key: "market-pro",
    name: "Market Pro",
    category: "متجر عام عالي التحويل",
    description:
      "نفس القالب لي في الفيديو - Featured Vendor + بانر + سلايدر فئات + منتجات + تقييمات. يبيع بزاف.",
    colors: ["#6257e8", "#f4b84a"],
    sections: [
      "featured_vendor",
      "promo_banner",
      "categories_slider",
      "featured_products",
      "how_it_works",
      "reviews_slider",
      "trust_badges",
      "newsletter",
    ],
    layout: "conversion",
    thumbnail: "/templates/market-pro.jpg",
    features: [
      "سلايدر منتجات أفقي",
      "تقييمات سلايدر",
      "شريط إعلان علوي",
      "أزرار CTA برتقالية",
    ],
    bestFor: "المتاجر العامة، سوبرماركت، متعدد الفئات",
  },
  {
    key: "fashion-luxe",
    name: "Fashion Luxe",
    category: "أزياء وموضة",
    description:
      "قالب فاخر مينيمال كيما Zara و Shein - صور كبيرة، خط عريض، يركز على اللوك.",
    colors: ["#0E0E0E", "#FF3B30"],
    sections: [
      "announcement",
      "header_transparent",
      "hero_fullscreen",
      "collection_grid",
      "lookbook",
      "featured_products",
      "story",
      "instagram_feed",
    ],
    layout: "editorial",
    thumbnail: "/templates/fashion-luxe.jpg",
    features: ["هيرو فول سكرين", "شبكة كولكشن", "لوك بوك", "انستغرام فيد"],
    bestFor: "ملابس، أحذية، اكسسوارات",
  },
  {
    key: "electro-hub",
    name: "Electro Hub",
    category: "إلكترونيات وهواتف",
    description:
      "قالب إلكترونيات احترافي كيما Jumia و Amazon - ميغا مينو، عداد عروض، جدول مواصفات.",
    colors: ["#0055FF", "#FFD60A"],
    sections: [
      "top_bar",
      "header_mega",
      "hero_deals",
      "categories_icons",
      "deals_countdown",
      "best_sellers",
      "benefits",
      "newsletter",
    ],
    layout: "marketplace",
    thumbnail: "/templates/electro-hub.jpg",
    features: ["ميغا مينو", "عداد عروض", "أيقونات فئات", "شارات ضمان"],
    bestFor: "هواتف، لابتوب، اكسسوارات إلكترونية",
  },
  {
    key: "beauty-glow",
    name: "Beauty Glow",
    category: "تجميل وعناية",
    description:
      "قالب تجميل ناعم كيما Sephora - يركز على قبل/بعد والريفيو والفيديو.",
    colors: ["#FF2D78", "#FFF0F5"],
    sections: [
      "announcement",
      "header",
      "hero_video",
      "bestsellers",
      "before_after",
      "testimonials",
      "benefits",
      "newsletter",
    ],
    layout: "beauty",
    thumbnail: "/templates/beauty-glow.jpg",
    features: ["هيرو فيديو", "قبل/بعد", "تقييمات صور", "ألوان ناعمة"],
    bestFor: "مكياج، عطور، عناية بالبشرة",
  },
] as const;

const customizationSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.string().trim().max(60),
  showCountdown: z.boolean(),
  showTrustBadges: z.boolean(),
  showNewsletter: z.boolean(),
});

const generatedThemeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(400),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.string().trim().max(60),
  sections: z.array(z.string()).min(3).max(8),
});

export const templatesRouter = router({
  presets: protectedProcedure.query(() => TEMPLATE_PRESETS),
  settings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getStoreThemeSettings(getStoreId(ctx));
    let customization = {};
    try {
      customization = JSON.parse(settings.customizationJson);
    } catch {
      customization = {};
    }
    return { templateKey: settings.templateKey, customization };
  }),
  save: protectedProcedure
    .input(
      z.object({
        templateKey: z.string().trim().min(1).max(80),
        customization: customizationSchema,
      })
    )
    .mutation(({ ctx, input }) =>
      saveStoreThemeSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  generate: protectedProcedure
    .input(z.object({ prompt: z.string().trim().min(12).max(1600) }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "انت مصمم قوالب متاجر الكترونية محترف. مهمتك توليد قالب حقيقي. القوالب البرو لازم يكون عندها layout مختلف و sections حقيقية مثل featured_vendor, promo_banner, categories_slider, featured_products, reviews_slider, how_it_works, trust_badges, hero_fullscreen, collection_grid. ركز على الموبايل اولا.",
          },
          {
            role: "user",
            content: "انشئ تصور قالب متجر برو من هذا الطلب: " + input.prompt,
          },
        ],
        response_format: { type: "json_object" },
      });
      const content = response.choices[0]?.message?.content;
      const raw =
        typeof content === "string" ? content : JSON.stringify(content ?? {});
      const parsed = generatedThemeSchema.parse(JSON.parse(raw));
      return { ...parsed, previewOnly: true };
    }),
});
