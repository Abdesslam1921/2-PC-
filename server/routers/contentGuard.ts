import { z } from "zod";
import {
  getContentGuardSettings,
  getPublicContentGuardForProduct,
  saveContentGuardSettings,
} from "../db";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const settingsInput = z.object({
  enabled: z.boolean(),
  protectImages: z.boolean(),
  blockRightClick: z.boolean(),
  preventSelection: z.boolean(),
  watermarkEnabled: z.boolean(),
  watermarkText: z.string().trim().max(120),
  blockHotlink: z.boolean(),
  blockAdReferrers: z.boolean(),
  blockMetaAdsLibrary: z.boolean(),
  blockedMessage: z.string().trim().max(255),
});

export const contentGuardRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getContentGuardSettings(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveContentGuardSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  publicForProduct: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicContentGuardForProduct(input.productId)),
});
