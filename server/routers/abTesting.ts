import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAiSettings, getStoreProductById } from "../db";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { getStoreId, protectedProcedure, router } from "../_core/trpc";

export type AbTestingVariant = {
  label: string;
  headline: string;
  subtext: string;
  cta: string;
  angle: string;
};

export const NO_AI_CREDIT_MESSAGE =
  "معندكش رصيد ذكاء اصطناعي حاليًا. أضف مفتاح API في ملف .env (AI_API_KEY) أو أرسله لنا لإضافته، ثم أعد المحاولة.";

const outputSchema = {
  name: "ai_ab_testing_variants",
  strict: true,
  schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            headline: { type: "string" },
            subtext: { type: "string" },
            cta: { type: "string" },
            angle: { type: "string" },
          },
          required: ["label", "headline", "subtext", "cta", "angle"],
          additionalProperties: false,
        },
      },
    },
    required: ["variants"],
    additionalProperties: false,
  },
} as const;

function visibleContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: unknown }).type === "text" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map(part => part.text)
    .join("");
}

function resolveAi({
  storeApiKey,
  storeApiUrl,
  storeModel,
}: {
  storeApiKey?: string | null;
  storeApiUrl?: string | null;
  storeModel?: string | null;
}) {
  const apiKey = ENV.aiApiKey || storeApiKey || "";
  const apiUrl = ENV.aiApiUrl || storeApiUrl || "";
  const model = ENV.aiApiModel || storeModel || "gemini-3-flash-preview";
  return { apiKey, apiUrl, model };
}

function isMissingApiKey(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /OPENAI_API_KEY is not configured|BUILT_IN_FORGE_API_KEY is not configured/i.test(
    message
  );
}

export const abTestingRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        count: z.number().int().min(2).max(5).default(3),
        locale: z.enum(["dz-ar", "ar", "fr-dz"]).default("dz-ar"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await getStoreProductById(
        getStoreId(ctx),
        input.productId
      );
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المنتج غير موجود أو لا تملك صلاحية استخدامه.",
        });

      const aiSettings = await getAiSettings(getStoreId(ctx));
      const { apiKey, apiUrl, model } = resolveAi({
        storeApiKey: aiSettings?.apiKey,
        storeApiUrl: aiSettings?.apiUrl,
        storeModel: aiSettings?.model,
      });
      if (!apiKey)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: NO_AI_CREDIT_MESSAGE,
        });

      const productData = JSON.stringify({
        title: product.title,
        description: product.description,
        type: product.productType,
        collection: product.collectionName,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        variants: product.variants.map(variant => ({
          color: variant.color,
          size: variant.size,
          price: variant.price,
          available: variant.available,
        })),
      });

      const result = await invokeLLM({
        model,
        apiKey,
        apiUrl: apiUrl || undefined,
        maxTokens: 3000,
        outputSchema,
        messages: [
          {
            role: "system",
            content:
              "أنت خبير تحويل CRO واختبار A/B لمتاجر عربية. أنشئ متغيرات صفحات هبوط متميزة فعليًا عن بعضها، كل متغير بزاوية بيع مختلفة وCTA مختلفة. اكتب بلغة المتجر المحددة وبنبرة محلية طبيعية. ممنوع اختراع مراجعات أو شهادات أو ادعاءات غير موجودة في بيانات المنتج. اجعل كل متغير يحمل وعدًا أو حافزًا مختلفًا (مثل: اطلب الآن، احصل عليه غدًا، الدفع عند الاستلام) بحيث يمكن قياس أي زاوية تحقق أعلى تحويل. أعد JSON فقط وفق المخطط المطلوب.",
          },
          {
            role: "user",
            content: `اللغة/اللهجة: ${input.locale}\nبيانات المنتج الفعلية: ${productData}\nعدد المتغيرات المطلوب: ${input.count}\nأنشئ ${input.count} متغيرات، كل متغير يشمل: label (مثل Landing A)، headline قصير ومركّز على التحويل، subtext داعم، cta (نص الزر)، وangle يصف زاوية البيع التي يمثلها. اجعل الـCTA مختلفًا بوضوح بين المتغيرات.`,
          },
        ],
      }).catch(error => {
        if (isMissingApiKey(error))
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: NO_AI_CREDIT_MESSAGE,
          });
        throw error;
      });

      const raw = visibleContent(result.choices[0]?.message.content ?? "");
      let parsed: { variants?: AbTestingVariant[] };
      try {
        parsed = JSON.parse(raw) as { variants?: AbTestingVariant[] };
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "أعاد الذكاء الاصطناعي مخططًا غير صالح. أعد المحاولة.",
        });
      }
      const variants = Array.isArray(parsed.variants)
        ? parsed.variants.filter(
            variant =>
              variant.label.trim() &&
              variant.cta.trim() &&
              variant.headline.trim()
          )
        : [];
      if (variants.length < 2)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لم يُنشئ الذكاء الاصطناعي متغيرات كافية. أعد المحاولة.",
        });
      return { variants: variants.slice(0, input.count), model: result.model };
    }),
});
