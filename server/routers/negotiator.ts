import { z } from "zod";
import {
  getNegotiatorSettings,
  listNegotiatorProductRules,
  replaceNegotiatorProductRules,
  saveNegotiatorSettings,
} from "../negotiatorDb";
import { getProductNegotiationEconomics } from "../negotiatorEconomics";
import { protectedProcedure, router, getStoreId } from "../_core/trpc";

const moneyInput = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .default("0.00");

const ruleInput = z.object({
  productId: z.number().int().positive(),
  enabled: z.boolean(),
  maxDiscountAmount: moneyInput,
  maxDiscountPercent: z.number().int().min(0).max(100),
  minPrice: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .nullable(),
  minProfitMarginPercent: z.number().int().min(0).max(100),
  freeDeliveryEnabled: z.boolean(),
  freeDeliveryMinQuantity: z.number().int().min(1).max(100),
  freeDeliveryMaxFee: moneyInput,
  customRules: z.string().trim().max(4000).nullable().optional(),
});

export const negotiatorRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getNegotiatorSettings(getStoreId(ctx))
  ),
  productRules: protectedProcedure.query(({ ctx }) =>
    listNegotiatorProductRules(getStoreId(ctx))
  ),
  economics: protectedProcedure.query(({ ctx }) =>
    getProductNegotiationEconomics(getStoreId(ctx))
  ),
  save: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        autoNegotiate: z.boolean(),
        rules: z.array(ruleInput).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveNegotiatorSettings(ctx.user.id, getStoreId(ctx), {
        enabled: input.enabled,
        autoNegotiate: input.autoNegotiate,
      });
      await replaceNegotiatorProductRules(
        ctx.user.id,
        getStoreId(ctx),
        input.rules
      );
      return {
        settings: await getNegotiatorSettings(getStoreId(ctx)),
        rules: await listNegotiatorProductRules(getStoreId(ctx)),
      };
    }),
});
