import { z } from "zod";
import {
  getPublicSharkCodSettings,
  getSharkCodAnalytics,
  getSharkCodProductAnalytics,
  getSharkCodSettings,
  getAiSettings,
  getStoreProductById,
  getWilayaConversionIntelligence,
  getContactBarSettings,
  getCroAuditSnapshot,
  getStoreThemeSettings,
  listConnecteurs,
  saveAiSettings,
  saveContactBarSettings,
  saveConnecteur,
  saveStoreThemeSettings,
  recordSharkCodEvent,
  saveSharkCodSettings,
} from "../db";
import type { CroAuditSnapshot } from "../db";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const SHARK_COD_EVENT_TYPES = [
  "view",
  "cta_click",
  "discount_order",
  "reject_price",
  "reject_delivery",
  "reject_compare",
  "reject_hesitate",
  "reject_payment",
  "reject_changed_mind",
] as const;
export const SHARK_COD_MAX_DISCOUNT = 90;
const eventType = z.enum(SHARK_COD_EVENT_TYPES);
const targetMode = z.enum(["all", "product", "landing"]);

const CRO_FINDING_SEVERITIES = ["red", "orange", "green"] as const;
type CroFindingSeverity = (typeof CRO_FINDING_SEVERITIES)[number];
type CroFinding = {
  severity: CroFindingSeverity;
  title: string;
  detail: string;
};

const CRO_SHARK_COD_DEFAULTS = {
  enabled: true,
  title: "قبل خروجك",
  descriptionBefore: "يمكنك الاستفادة من تخفيض خاص",
  descriptionAfter: "هذا التخفيض لن يظهر لك مرة أخرى",
  buttonText: "الاستفادة من هذا التخفيض",
  discountPercent: 10,
  targetMode: "all" as const,
  targetProductId: null as number | null,
  targetLandingPageId: null as number | null,
};

const CRO_AUTO_FIXES = [
  {
    key: "shark_cod",
    label: "نافذة تخفيض الخروج (Shark COD)",
    description: "تفعيل نافذة عرض التخفيض عند محاولة مغادرة الزائر بنسبة 10%",
  },
  {
    key: "abandoned_orders",
    label: "تتبع السلال المتروكة",
    description: "تفعيل تسجيل الزوار الذين يتركون الطلب في الشك أوت",
  },
  {
    key: "theme_trust",
    label: "شارات الثقة والعداد",
    description: "إظهار شارات الثقة وعداد العروض في القالب لبناء الطمأنينة",
  },
  {
    key: "contact_bar",
    label: "شريط التواصل",
    description: "تفعيل شريط الهاتف/واتساب فوق صفحات المتجر عند توفّر رقم",
  },
] as const;

function parseCroFindings(text: string): CroFinding[] {
  let raw = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    if (!title) return [];
    const severity: CroFindingSeverity = CRO_FINDING_SEVERITIES.includes(
      obj.severity as CroFindingSeverity
    )
      ? (obj.severity as CroFindingSeverity)
      : "orange";
    return [
      {
        severity,
        title: title.slice(0, 180),
        detail:
          typeof obj.detail === "string" ? obj.detail.trim().slice(0, 500) : "",
      },
    ];
  });
}

function buildCroAuditPrompt(snapshot: CroAuditSnapshot): string {
  return `أنت "AI CRO Agent": خبير تحسين معدل التحويل (CRO) لمتاجر إلكترونية جزائرية تعمل بالدفع عند الاستلام (COD).

افحص متجر التاجر اعتمادًا على البيانات الحقيقية التالية (JSON) فقط، ولا تختلق أرقامًا أو حقائق غير موجودة فيها:
${JSON.stringify(snapshot, null, 2)}

راجع هذه الجوانب واحدًا واحدًا واحكم عليها بالأدلة من البيانات:
1) Product page (صفحة المنتج) 2) Checkout (إتمام الطلب) 3) Loading speed (سرعة التحميل) 4) CTA (أزرار الحث) 5) Pricing (التسعير) 6) Reviews (التقييمات) 7) Trust (الثقة) 8) Images (الصور) 9) Delivery information (معلومات التوصيل) 10) Abandoned carts (السلال المتروكة) 11) Conversion rate (معدل التحويل)

حقائق بنيوية يجب احترامها:
- المنصة لا تدعم فيديو المنتج ولا تقييمات Reviews حقيقية من الزبائن. صفحة المنتج تعرض شهادات/تستيمونيال ثابتة، وشارات الثقة تُفعَّل من إعدادات القالب (theme).
- سعر التوصيل يُحتسب فقط عندما يصل الزبون إلى الشك أوت (checkout)، ولا يظهر فوق صفحة المنتج/اللاندينق إلا إذا ذكره التاجر بنفسه.
- السلة المتروكة = زائر بدأ إتمام الطلب دون شراء؛ يمكن تتبّعها عبر خيار abandoned_orders.
- سرعة التحميل لا يمكن قياسها من هذه البيانات: لا تدّعِ معرفتها، واكتفِ بتوصية عامة عند الحاجة.

إصلاحات يمكن للتاجر تطبيقها تلقائيًا بضغطة زر (استخدمها كمرجع عند اقتراح الإجراءات):
- shark_cod: تفعيل نافذة تخفيض الخروج Shark COD بنسبة 10% إذا كانت معطّلة.
- abandoned_orders: تفعيل تتبع السلال المتروكة إذا كان معطّلًا.
- theme_trust: إظهار شارات الثقة وعداد العروض في القالب إذا كانت مخفية.
- contact_bar: تفعيل شريط الهاتف/واتساب إذا وُجد رقم محفوظ.

أخرج JSON فقط بدون أي markdown وبدون أي نص خارجي، بهذا الشكل:
{"findings":[{"severity":"red","title":"...","detail":"..."}]}

قواعد النتائج:
- severity: "red" = مشكلة حرجة تمنع الطلبات وتُسبب الهروب، "orange" = مشكلة أو تحسين ثانوي مهم، "green" = نقطة قوة حقيقية في المتجر حاليًا (وليست مشكلة).
- اذكر من 3 إلى 6 نتائج مرتبة حسب الأولوية: الحمراء أولًا ثم البرتقالية ثم الخضراء. نتيجة خضراء واحدة تكفي إن وُجدت فعلًا.
- title: عنوان قصير واضح بلغة مقنعة مثل: "سعر التوصيل يظهر متأخرًا" أو "لا توجد تقييمات Reviews".
- detail: جملة أو جملتان مدعومتان بالأرقام من البيانات + إجراء عملي مقترح (اذكر الإصلاح التلقائي إن كان متاحًا).
- اكتب كل شيء بالعربية مع الحفاظ على المصطلحات الإنجليزية مثل CTA و Reviews و Checkout.`;
}

export const sharkCodRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getSharkCodSettings(getStoreId(ctx))
  ),
  analytics: protectedProcedure.query(({ ctx }) =>
    getSharkCodAnalytics(getStoreId(ctx))
  ),
  productAnalytics: protectedProcedure.query(async ({ ctx }) =>
    getSharkCodProductAnalytics(getStoreId(ctx))
  ),
  wilayaConversionIntelligence: protectedProcedure
    .input(z.object({ productId: z.number().int().positive().nullable().optional() }))
    .query(async ({ ctx, input }) =>
      getWilayaConversionIntelligence(getStoreId(ctx), input?.productId ?? null)
    ),
  aiSettings: protectedProcedure.query(({ ctx }) =>
    getAiSettings(getStoreId(ctx))
  ),
  saveAiSettings: protectedProcedure
    .input(
      z.object({
        provider: z.string().trim().min(2).max(60),
        apiKey: z.string().trim().min(10).max(255),
        apiUrl: z.string().trim().url().max(255),
        model: z.string().trim().min(1).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => saveAiSettings(getStoreId(ctx), input)),
  generateRecommendations: protectedProcedure.mutation(async ({ ctx }) => {
    const analytics = await getSharkCodAnalytics(getStoreId(ctx));
    const aiSettings = await getAiSettings(getStoreId(ctx));
    const prompt = `أنت مستشار تجربة عملاء ذكي لمنصة تجارة إلكترونية عربية. بناءً على بيانات متجر العميل التالية، أعطِ 3 توصيات عملية ومحددة باللغة العربية لتحسين معدل إتمام الطلب وتقليل الهروب.

البيانات:
- مشاهدات نافذة الخروج: ${analytics.views}
- نقرات زر العرض: ${analytics.ctaClicks}
- نسبة النقر (CTR): ${analytics.ctr}%
- طلبات بالتخفيض: ${analytics.discountOrders}
- نسبة التحويل: ${analytics.conversionRate}%
- أسباب رفض العرض: ${JSON.stringify(analytics.rejections)}

كل recommendation يجب أن تكون جملة واحدة عملية ومحددة، ولا تعطي نصائح عامة. ركز على البيانات الظاهرة.`;
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
      apiKey: aiSettings?.apiKey,
      apiUrl: aiSettings?.apiUrl,
      model: aiSettings?.model,
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text !== "string")
      return { recommendations: ["تعذر توليد التوصيات حالياً."] };
    const items = text
      .split(/\n+/)
      .map(line => line.replace(/^[\-\*\d\.\s]+/, "").trim())
      .filter(Boolean);
    return { recommendations: items.slice(0, 5) };
  }),
  generateProductRecommendations: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const aiSettings = await getAiSettings(getStoreId(ctx));
      const product = await getStoreProductById(
        getStoreId(ctx),
        input.productId
      );
      if (!product) throw new Error("المنتج غير موجود.");
      const prompt = `أنت مستشعر تجربة عملاء ذكي لمنصة تجارة إلكترونية عربية. قدم 3 توصيات عملية ومحددة باللغة العربية لتحسين مبيعات المنتج التالي وتقليل الهروب من عرضه.

بيانات المنتج:
- العنوان: ${product.title}
- السعر: ${product.price}
- الوصف: ${product.description.slice(0, 500)}
- أكوام المنتج: ${product.images.length}

ركز على التحسينات الممكنة في العرض، التسعير، أو المحتوى. كل توصيه جملة واحدة.`;
      const result = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 400,
        apiKey: aiSettings?.apiKey,
        apiUrl: aiSettings?.apiUrl,
        model: aiSettings?.model,
      });
      const text = result.choices[0]?.message?.content;
      if (typeof text !== "string")
        return { recommendations: ["تعذر توليد التوصيات حالياً."] };
      const items = text
        .split(/\n+/)
        .map(line => line.replace(/^[\-\*\d\.\s]+/, "").trim())
        .filter(Boolean);
      return { recommendations: items.slice(0, 5) };
    }),
generateWilayaRecommendations: protectedProcedure.mutation(async ({ ctx }) => {
    const wilayaData = await getWilayaConversionIntelligence(getStoreId(ctx));
    const aiSettings = await getAiSettings(getStoreId(ctx));
    if (!wilayaData.length) return { recommendations: ["لا توجد بيانات كافية للتحليل."] };
    const topWilayas = wilayaData.slice(0, 10).map(w =>
      `${w.wilaya}: تحويل ${w.conversionRate}%، تأكيد ${w.confirmationRate}%، توصيل ${w.deliveryTime} يوم، رفض ${w.refusalRate}%، AOV ${w.averageOrderValue} دج، CAC ${w.cac} دج، ربح/طلب ${w.profitPerDeliveredOrder} دج`
    ).join("\n");
    const prompt = `أنت خبير تحليل جغرافي لتجارة إلكترونية في الجزائر. بناءً على بيانات التحويل حسب الولايات التالية، أعطِ 5 توصيات عملية ومحددة باللغة العربية لتحسين الأداء. ركز على الفروقات الجغرافية، ولا تعطِ نصائح عامة.

البيانات (أفضل 10 ولايات حسب عدد الطلبات):
${topWilayas}

مثال على نمط التوصية المطلوبة:
- "لا تستعمل نفس الـ offer في أدرار: نسبة الرفض 21% ومدة التوصيل 3.8 يوم، غيّر الاستراتيجية لعرض مكتب أو زيادة التخفيض."
- "ركز ميزانية الإعلانات على بومرداس والبليدة: تحويل عالي (>4%) وتوصيل سريع (<2 يوم) ورِبح جيد."

كل توصية جملة واحدة، عملية، ومبنية على الأرقام.`;
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 800,
      apiKey: aiSettings?.apiKey,
      apiUrl: aiSettings?.apiUrl,
      model: aiSettings?.model,
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text !== "string")
      return { recommendations: ["تعذر توليد التوصيات حالياً."] };
    const items = text
      .split(/\n+/)
      .map(line => line.replace(/^[\-\*\d\.\s]+/, "").trim())
      .filter(Boolean);
    return { recommendations: items.slice(0, 8) };
  }),
  save: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        title: z.string().trim().min(2).max(180),
        descriptionBefore: z.string().trim().min(2).max(1000),
        descriptionAfter: z.string().trim().min(2).max(1000),
        buttonText: z.string().trim().min(2).max(180),
        discountPercent: z.number().int().min(0).max(SHARK_COD_MAX_DISCOUNT),
        targetMode,
        targetProductId: z.number().int().positive().nullable().optional(),
        targetLandingPageId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      saveSharkCodSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  publicSettings: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        landingPageId: z.number().int().positive().optional(),
      })
    )
    .query(({ input }) =>
      getPublicSharkCodSettings(input.productId, input.landingPageId)
    ),
  track: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        landingPageId: z.number().int().positive().optional(),
        eventType,
        sessionId: z.string().trim().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const settings = await getPublicSharkCodSettings(
        input.productId,
        input.landingPageId
      );
      if (!settings) return { recorded: false } as const;
      await recordSharkCodEvent({
        ownerId: settings.ownerId,
        storeId: settings.storeId,
        settingsId: settings.id,
        eventType: input.eventType,
        productId: input.productId,
        landingPageId: input.landingPageId,
        sessionId: input.sessionId,
      });
      return { recorded: true } as const;
    }),
  generateCroAudit: protectedProcedure.mutation(async ({ ctx }) => {
    const storeId = getStoreId(ctx);
    const aiSettings = await getAiSettings(storeId);
    const snapshot = await getCroAuditSnapshot(storeId);
    const result = await invokeLLM({
      messages: [{ role: "user", content: buildCroAuditPrompt(snapshot) }],
      response_format: { type: "json_object" },
      maxTokens: 1000,
      apiKey: aiSettings?.apiKey,
      apiUrl: aiSettings?.apiUrl,
      model: aiSettings?.model,
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text !== "string")
      return {
        findings: [
          {
            severity: "orange" as const,
            title: "تعذر إجراء الفحص حاليًا",
            detail: "لم يستجب نموذج الذكاء الاصطناعي، حاول مجددًا بعد لحظات.",
          },
        ],
      };
    const findings = parseCroFindings(text).slice(0, 6);
    if (!findings.length)
      return {
        findings: [
          {
            severity: "orange" as const,
            title: "تعذر تحليل بيانات المتجر",
            detail: "لم يتمكن الذكاء الاصطناعي من قراءة بيانات متجرك، حاول مجددًا.",
          },
        ],
      };
    return { findings };
  }),
  autoFixCroIssues: protectedProcedure.mutation(async ({ ctx }) => {
    const ownerId = ctx.user.id;
    const storeId = getStoreId(ctx);
    const results: Array<{
      key: string;
      label: string;
      description: string;
      ok: boolean;
      detail: string;
    }> = [];

    const shark = await getSharkCodSettings(storeId);
    if (shark?.enabled) {
      results.push({
        key: "shark_cod",
        label: CRO_AUTO_FIXES[0].label,
        description: CRO_AUTO_FIXES[0].description,
        ok: false,
        detail: "نافذة تخفيض الخروج مفعّلة مسبقًا.",
      });
    } else {
      await saveSharkCodSettings(ownerId, storeId, {
        ...CRO_SHARK_COD_DEFAULTS,
        targetMode: CRO_SHARK_COD_DEFAULTS.targetMode,
      });
      results.push({
        key: "shark_cod",
        label: CRO_AUTO_FIXES[0].label,
        description: CRO_AUTO_FIXES[0].description,
        ok: true,
        detail: "تم تفعيل نافذة تخفيض الخروج بنسبة 10% على كل المنتجات.",
      });
    }

    const connecteurs = await listConnecteurs(storeId);
    const abandoned = connecteurs.find(c => c.kind === "abandoned_orders");
    if (abandoned?.enabled) {
      results.push({
        key: "abandoned_orders",
        label: CRO_AUTO_FIXES[1].label,
        description: CRO_AUTO_FIXES[1].description,
        ok: false,
        detail: "تتبع السلال المتروكة مفعّل مسبقًا.",
      });
    } else {
      await saveConnecteur(ownerId, storeId, {
        kind: "abandoned_orders",
        label: "تتبع السلال المتروكة",
        enabled: true,
      });
      results.push({
        key: "abandoned_orders",
        label: CRO_AUTO_FIXES[1].label,
        description: CRO_AUTO_FIXES[1].description,
        ok: true,
        detail: "أصبح الزوار الذين يتركون السلة يُسجَّلون تلقائيًا.",
      });
    }

    const theme = await getStoreThemeSettings(storeId);
    let customization: Record<string, unknown> = {};
    try {
      customization = JSON.parse(theme.customizationJson);
    } catch {
      customization = {};
    }
    if (customization.showTrustBadges !== false && customization.showCountdown !== false) {
      results.push({
        key: "theme_trust",
        label: CRO_AUTO_FIXES[2].label,
        description: CRO_AUTO_FIXES[2].description,
        ok: false,
        detail: "شارات الثقة والعداد ظاهرتان في القالب مسبقًا.",
      });
    } else {
      await saveStoreThemeSettings(ownerId, storeId, {
        templateKey: theme.templateKey,
        customization: {
          ...customization,
          showTrustBadges: true,
          showCountdown: true,
        },
      });
      results.push({
        key: "theme_trust",
        label: CRO_AUTO_FIXES[2].label,
        description: CRO_AUTO_FIXES[2].description,
        ok: true,
        detail: "تم تفعيل شارات الثقة والعداد في قالب متجرك.",
      });
    }

    const contact = await getContactBarSettings(storeId);
    const hasNumber = Boolean(contact.phoneNumber || contact.whatsappNumber);
    if (!hasNumber) {
      results.push({
        key: "contact_bar",
        label: CRO_AUTO_FIXES[3].label,
        description: CRO_AUTO_FIXES[3].description,
        ok: false,
        detail:
          "لا يوجد رقم هاتف أو واتساب محفوظ. احفظ رقمك في إعدادات شريط التواصل أولًا.",
      });
    } else if (contact.enabled) {
      results.push({
        key: "contact_bar",
        label: CRO_AUTO_FIXES[3].label,
        description: CRO_AUTO_FIXES[3].description,
        ok: false,
        detail: "شريط التواصل مفعّل مسبقًا.",
      });
    } else {
      await saveContactBarSettings(ownerId, storeId, {
        enabled: true,
        phoneEnabled: contact.phoneEnabled,
        phoneNumber: contact.phoneNumber,
        phoneSticky: contact.phoneSticky,
        whatsappEnabled: contact.whatsappEnabled,
        whatsappNumber: contact.whatsappNumber,
        whatsappSticky: contact.whatsappSticky,
        showOnStore: contact.showOnStore,
        showOnProduct: contact.showOnProduct,
        showOnLanding: contact.showOnLanding,
      });
      results.push({
        key: "contact_bar",
        label: CRO_AUTO_FIXES[3].label,
        description: CRO_AUTO_FIXES[3].description,
        ok: true,
        detail: "تم تفعيل شريط التواصل فوق صفحات المتجر.",
      });
    }

    return { results };
  }),
});
