import { z } from "zod";
import {
  getContactBarSettings,
  getPublicContactBarForProduct,
  saveContactBarSettings,
} from "../db";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const settingsInput = z
  .object({
    enabled: z.boolean(),
    phoneEnabled: z.boolean(),
    phoneNumber: z.string().trim().max(30),
    phoneSticky: z.boolean(),
    whatsappEnabled: z.boolean(),
    whatsappNumber: z.string().trim().max(30),
    whatsappSticky: z.boolean(),
    showOnStore: z.boolean(),
    showOnProduct: z.boolean(),
    showOnLanding: z.boolean(),
  })
  .superRefine((input, ctx) => {
    if (input.phoneEnabled && input.phoneNumber.replace(/\D/g, "").length < 9)
      ctx.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "أدخل رقم هاتف صالحًا قبل تفعيل زر الهاتف.",
      });
    if (
      input.whatsappEnabled &&
      input.whatsappNumber.replace(/\D/g, "").length < 9
    )
      ctx.addIssue({
        code: "custom",
        path: ["whatsappNumber"],
        message: "أدخل رقم WhatsApp صالحًا قبل تفعيل الزر.",
      });
  });

export const contactBarRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getContactBarSettings(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveContactBarSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  publicForProduct: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicContactBarForProduct(input.productId)),
});
