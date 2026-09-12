import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { processDueRetargetSends } from "../trackingRetarget";
import {
  getPublicTrackingBox,
  getTrackingRetargetAnalytics,
  getTrackingRetargetSettings,
  listRecentlySent,
  saveTrackingRetargetSettings,
} from "../trackingRetargetDb";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const supportNumberInput = z
  .object({
    label: z.string().trim().max(160),
    number: z.string().trim().max(30),
    active: z.boolean(),
  })
  .superRefine((number, context) => {
    if (number.active && number.number.replace(/\D/g, "").length < 9)
      context.addIssue({
        code: "custom",
        path: ["number"],
        message: "أدخل رقم WhatsApp صالحًا للرقم المفعّل.",
      });
  });

const settingsInput = z
  .object({
    enabled: z.boolean(),
    whatsappPhoneId: z.string().trim().max(80),
    whatsappToken: z.string().trim().max(2000).optional(),
    clearWhatsappToken: z.boolean().optional().default(false),
    supportNumbers: z.array(supportNumberInput).max(12),
    trackTitle: z.string().trim().max(180),
    trackHint: z.string().trim().max(500),
    trackCta: z.string().trim().max(180),
    trackMessage: z.string().trim().max(500),
    statusEnabled: z.boolean(),
    statusMessage: z.string().trim().max(2000),
    retargetEnabled: z.boolean(),
    retargetTargetType: z.enum(["product", "landing"]).default("product"),
    retargetProductId: z.number().int().positive().nullable().optional(),
    retargetLandingPageId: z.number().int().positive().nullable().optional(),
    retargetLandingUrl: z.string().trim().max(2000),
    retargetDiscountPercent: z.number().int().min(0).max(90),
    retargetDelayDays: z.number().int().min(0).max(90),
    retargetMessage: z.string().trim().max(4000),
  })
  .superRefine((settings, context) => {
    if (
      settings.enabled &&
      settings.retargetEnabled &&
      !settings.retargetProductId
    )
      context.addIssue({
        code: "custom",
        path: ["retargetProductId"],
        message: "اختر منتج حملة الاسترجاع.",
      });
    if (
      settings.enabled &&
      settings.retargetTargetType === "landing" &&
      !settings.retargetLandingPageId &&
      !settings.retargetLandingUrl
    )
      context.addIssue({
        code: "custom",
        path: ["retargetLandingPageId"],
        message: "اختر صفحة هبوط أو أضف رابطًا خاصًا لصفحة الهبوط.",
      });
  });

export const trackingRetargetRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getTrackingRetargetSettings(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) => {
      try {
        return saveTrackingRetargetSettings(
          ctx.user.id,
          getStoreId(ctx),
          input
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "تعذر حفظ إعدادات Tracking & Retargeting.",
        });
      }
    }),
  publicForProduct: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicTrackingBox(input.productId)),
  analytics: protectedProcedure.query(({ ctx }) =>
    getTrackingRetargetAnalytics(getStoreId(ctx))
  ),
  recentSends: protectedProcedure.query(({ ctx }) =>
    listRecentlySent(getStoreId(ctx), 8)
  ),
  runDueNow: protectedProcedure.mutation(async () =>
    processDueRetargetSends(100)
  ),
});
