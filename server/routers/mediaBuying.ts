import { z } from "zod";
import { router, protectedProcedure, getStoreId } from "../_core/trpc";
import { askMediaBuyingAi, prepareCampaignDraft } from "../mediaBuyingAi";
import { createMetaOAuthUrl } from "../metaOAuth";
import {
  executeMetaCampaign,
  listMetaCampaignAuditLogs,
} from "../metaCampaignExecution";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
});
const draftSchema = z.object({
  name: z.string().trim().min(1).max(255),
  objective: z.string().trim().min(1),
  buyingType: z.string().trim().min(1),
  budgetMode: z.enum(["CBO", "ABO"]),
  dailyBudgetDzd: z.number().nullable(),
  audience: z.string(),
  adSets: z
    .array(
      z.object({
        name: z.string(),
        optimizationGoal: z.string(),
        audience: z.string(),
      })
    )
    .min(1),
  creatives: z
    .array(
      z.object({
        name: z.string(),
        format: z.string(),
        primaryText: z.string(),
        headline: z.string(),
        callToAction: z.string(),
        destinationUrl: z.string().nullable(),
      })
    )
    .min(1),
  rationale: z.array(z.string()),
  warnings: z.array(z.string()),
  missingInputs: z.array(z.string()),
});

export const mediaBuyingRouter = router({
  ask: protectedProcedure
    .input(z.object({ messages: z.array(messageSchema).min(1).max(30) }))
    .mutation(({ ctx, input }) =>
      askMediaBuyingAi(getStoreId(ctx), input.messages)
    ),
  preview: protectedProcedure
    .input(z.object({ messages: z.array(messageSchema).min(1).max(30) }))
    .mutation(({ ctx, input }) =>
      prepareCampaignDraft(getStoreId(ctx), input.messages)
    ),
  startOAuth: protectedProcedure.mutation(({ ctx }) =>
    createMetaOAuthUrl(ctx.user.id, getStoreId(ctx), ctx.req)
  ),
  execute: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        draft: draftSchema,
        pageId: z.string().trim(),
        imageHash: z.string().trim(),
        destinationUrl: z.string().trim(),
        targetingJson: z.string().trim(),
        optimizationGoal: z.string().trim(),
        billingEvent: z.string().trim(),
        confirmationPhrase: z.string(),
      })
    )
    .mutation(({ ctx, input }) =>
      executeMetaCampaign({
        ownerId: ctx.user.id,
        storeId: getStoreId(ctx),
        ...input,
      })
    ),
  auditLogs: protectedProcedure.query(({ ctx }) =>
    listMetaCampaignAuditLogs(getStoreId(ctx))
  ),
});
