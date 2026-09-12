import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  approveLandingPage,
  completeLandingGeneration,
  createLandingGeneration,
  discardLandingGeneration,
  getLandingPageForOwner,
  getLandingPagePublicPreview,
  getStoreProductById,
  listLandingPagesForOwner,
  replaceLandingScenes,
} from "../db";
import {
  generateLandingDraft,
  generateLandingScenes,
} from "../landingGeneration";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";
import { storageGetSignedUrl } from "../storage";

const settingsInput = z.object({
  slug: z
    .string()
    .trim()
    .max(180)
    .regex(
      /^$|^[a-z0-9-]{3,}$/,
      "استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط في المسار."
    )
    .optional()
    .default(""),
  delivery: z.string().trim().max(120).optional().default(""),
  payment: z.literal("cod").default("cod"),
  metaPixel: z.string().trim().max(160).optional(),
  tiktokPixel: z.string().trim().max(160).optional(),
  snapchatPixel: z.string().trim().max(160).optional(),
  thankYou: z.string().trim().max(400).optional(),
});

function landingGenerationError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/usage exhausted|failed_precondition/i.test(message))
    return "تم بلوغ الحد المتاح لتوليد الصور حاليًا. لم تُحفظ هذه المسودة؛ أعد المحاولة عند توفر التوليد.";
  return message || fallback;
}

export const landingsRouter = router({
  publicRead: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const page = await getLandingPagePublicPreview(input.id);
      if (!page)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "صفحة الهبوط غير متاحة للعرض.",
        });
      return page;
    }),
  createAiDraft: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        pageLength: z.enum(["short", "medium", "long"]),
        locale: z.enum(["dz-ar", "ar", "fr-dz"]).default("dz-ar"),
        notes: z.string().trim().max(400).optional(),
        settings: settingsInput,
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
      if (!product.images.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "أضف صورة أصلية واحدة على الأقل للمنتج قبل التوليد.",
        });
      const slug =
        input.settings.slug ||
        `landing-${product.id}-${Date.now().toString(36)}`;
      const landingPageId = await createLandingGeneration(
        getStoreId(ctx),
        product,
        { ...input, settings: { ...input.settings, slug } }
      );
      try {
        const { draft, referenceImageUrl } = await generateLandingDraft({
          product: {
            title: product.title,
            description: product.description,
            productType: product.productType,
            collectionName: product.collectionName,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            images: product.images.map(image => ({
              url: image.url,
              storageKey: image.storageKey,
              altText: image.altText,
            })),
            variants: product.variants.map(variant => ({
              color: variant.color,
              size: variant.size,
              price: variant.price,
              available: variant.available,
            })),
          },
          length: input.pageLength,
          locale: input.locale,
          notes: input.notes,
        });
        if (!referenceImageUrl)
          throw new Error("تعذر تجهيز مرجع صورة المنتج للمشهد الإبداعي.");
        const scenes = await generateLandingScenes({
          referenceImageUrl,
          sections: draft.sections,
          designSystem: draft.designSystem,
        });
        const page = await completeLandingGeneration(
          getStoreId(ctx),
          landingPageId,
          draft.designSystem,
          draft.sections,
          scenes,
          product.images[0]?.url
        );
        if (!page) throw new Error("تعذر تحميل مسودة الصفحة بعد التوليد.");
        return page;
      } catch (error) {
        const message = landingGenerationError(
          error,
          "تعذر إنشاء المسودة بالذكاء الاصطناعي."
        );
        await discardLandingGeneration(getStoreId(ctx), landingPageId);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const page = await getLandingPageForOwner(getStoreId(ctx), input.id);
      if (!page)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "مسودة صفحة الهبوط غير موجودة.",
        });
      return page;
    }),
  list: protectedProcedure.query(({ ctx }) =>
    listLandingPagesForOwner(getStoreId(ctx))
  ),
  approve: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const page = await getLandingPageForOwner(getStoreId(ctx), input.id);
      if (!page)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "مسودة صفحة الهبوط غير موجودة.",
        });
      if (page.status !== "ready")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن اعتماد مسودة لم يكتمل توليدها.",
        });
      const approved = await approveLandingPage(getStoreId(ctx), input.id);
      if (!approved?.approvedAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "تعذر اعتماد صفحة الهبوط.",
        });
      return approved;
    }),
  regenerateScenes: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const page = await getLandingPageForOwner(getStoreId(ctx), input.id);
      if (!page)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "مسودة صفحة الهبوط غير موجودة.",
        });
      const product = await getStoreProductById(
        getStoreId(ctx),
        page.productId
      );
      if (!product?.images[0])
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا توجد صورة أصلية للمنتج لإعادة توليد المشاهد.",
        });
      let designSystem: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        backgroundTone: string;
        visualMood: string;
      };
      try {
        designSystem = JSON.parse(page.designSystemJson ?? "{}");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "إعدادات التصميم غير صالحة لإعادة التوليد.",
        });
      }
      if (!designSystem.primaryColor || !page.sections.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "المسودة لا تحتوي على بيانات كافية لإعادة توليد المشاهد.",
        });
      const image = product.images[0];
      const referenceImageUrl = image.url.startsWith("http")
        ? image.url
        : await storageGetSignedUrl(image.storageKey);
      try {
        const scenes = await generateLandingScenes({
          referenceImageUrl,
          designSystem,
          sections: page.sections.map(section => ({
            aidaStage: section.aidaStage,
            sectionType: section.sectionType,
            eyebrow: section.eyebrow,
            headline: section.headline,
            body: section.body,
            bullets: JSON.parse(section.bulletsJson) as string[],
            ctaLabel: section.ctaLabel,
            visualBrief: section.visualBrief,
          })),
        });
        const updated = await replaceLandingScenes(
          getStoreId(ctx),
          page.id,
          scenes
        );
        if (!updated)
          throw new Error("تعذر تحميل المسودة بعد إعادة توليد المشاهد.");
        return updated;
      } catch (error) {
        const message = landingGenerationError(
          error,
          "تعذر إعادة توليد المشاهد."
        );
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
