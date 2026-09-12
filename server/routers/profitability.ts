import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import {
  getMetaAdAccountSecret,
  getProfitabilitySettings,
  listCampaignProductLinks,
  listMetaAdAccounts,
  removeMetaAdAccount,
  saveCampaignProductLinks,
  saveMetaAdAccount,
  saveProfitabilitySettings,
} from "../profitabilityDb";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, getStoreId } from "../_core/trpc";
import { getProfitabilityReport } from "../profitabilityReport";
import { syncMetaAdAccount } from "../metaAdsSync";
import { createHeartbeatJob } from "../_core/heartbeat";
import { analyzeProfitabilityCampaigns } from "../profitabilityAi";
import { setMetaAdAccountSchedule } from "../profitabilityDb";

export const profitabilityCampaignLinksInput = z.object({
  links: z
    .array(
      z.object({
        campaignId: z.string().trim().min(1).max(80),
        productId: z.number().int().positive().nullable(),
      })
    )
    .max(500),
});
export function normalizeMetaAdAccountId(value: string) {
  const cleaned = value.trim().replace(/^act_/i, "");
  if (!/^\d+$/.test(cleaned)) throw new Error("معرف حساب Meta غير صالح.");
  return `act_${cleaned}`;
}
const rate = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,4})?$/, "أدخل سعر صرف صحيحًا.");

export const profitabilityRouter = router({
  report: protectedProcedure.query(({ ctx }) =>
    getProfitabilityReport(getStoreId(ctx))
  ),
  analyzeCampaigns: protectedProcedure.mutation(({ ctx }) =>
    analyzeProfitabilityCampaigns(getStoreId(ctx))
  ),
  settings: protectedProcedure.query(({ ctx }) =>
    getProfitabilitySettings(getStoreId(ctx))
  ),
  campaignLinks: protectedProcedure.query(({ ctx }) =>
    listCampaignProductLinks(getStoreId(ctx))
  ),
  saveCampaignLinks: protectedProcedure
    .input(profitabilityCampaignLinksInput)
    .mutation(({ ctx, input }) =>
      saveCampaignProductLinks(ctx.user.id, getStoreId(ctx), input.links)
    ),
  saveSettings: protectedProcedure
    .input(z.object({ usdToDzdRate: rate, includePendingOrders: z.boolean() }))
    .mutation(({ ctx, input }) =>
      saveProfitabilitySettings(ctx.user.id, getStoreId(ctx), input)
    ),
  metaAccounts: protectedProcedure.query(({ ctx }) =>
    listMetaAdAccounts(getStoreId(ctx))
  ),
  saveMetaAccount: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        externalAccountId: z
          .string()
          .trim()
          .min(3)
          .max(80)
          .refine(
            value => /^act_?\d+$/i.test(value),
            "أدخل Ad Account ID صحيحًا."
          ),
        name: z.string().trim().min(2).max(255),
        currency: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{3,8}$/),
        accessToken: z.string().trim().min(20).max(4096).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      saveMetaAdAccount(ctx.user.id, getStoreId(ctx), {
        ...input,
        externalAccountId: normalizeMetaAdAccountId(input.externalAccountId),
      })
    ),
  removeMetaAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      removeMetaAdAccount(getStoreId(ctx), input.id)
    ),
  verifyMetaAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const account = await getMetaAdAccountSecret(getStoreId(ctx), input.id);
      return {
        success: Boolean(account.accessToken),
        accountId: account.externalAccountId,
      };
    }),
  syncMetaAccount: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        dateStart: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
        dateStop: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) =>
      syncMetaAdAccount(
        getStoreId(ctx),
        input.id,
        input.dateStart,
        input.dateStop
      )
    ),
  scheduleMetaSync: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        cron: z
          .string()
          .regex(
            /^\\d+ \\d+ \\d+ \\* \\* \\*$/,
            "صيغة الجدولة يجب أن تحتوي على 6 حقول."
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionToken =
        parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "جلسة المستخدم غير متاحة للجدولة.",
        });
      const job = await createHeartbeatJob(
        {
          name: `meta-sync-${getStoreId(ctx)}-${input.id}`,
          cron: input.cron,
          path: "/api/scheduled/metaAdsSync",
          description: "مزامنة إنفاق Meta Ads مع Profitability Engine",
        },
        sessionToken
      );
      await setMetaAdAccountSchedule(getStoreId(ctx), input.id, job.taskUid);
      return job;
    }),
});
