import { z } from "zod";
import {
  getPublicThankYouPopup,
  getThankYouPopupSettings,
  saveThankYouPopupSettings,
} from "../db";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const settingsInput = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(2000),
  buttonText: z.string().trim().max(180),
  buttonUrl: z.string().trim().max(2000),
});

export const thankYouRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getThankYouPopupSettings(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveThankYouPopupSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  publicForProduct: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicThankYouPopup(input.productId)),
});

export const THANK_YOU_POPUP_DEFAULTS = {
  message: "تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت. شكرًا لثقتك بنا.",
  buttonText: "خروج",
  buttonUrl: "/",
} as const;
