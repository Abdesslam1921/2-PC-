import { z } from "zod";
import {
  deleteConnecteur,
  getConnecteurPixelCredentials,
  getPublicStoreProduct,
  getPublicTurnstileSiteKey,
  listConnecteurs,
  saveConnecteur,
  saveConnecteurPixels,
} from "../db";
import { sendConversionEvent } from "../conversions";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";
import { syncOrdersToGoogleSheet } from "../googleSheets";

export const connecteurKinds = [
  "meta_capi",
  "tiktok_capi",
  "snapchat_capi",
  "facebook_domain",
  "cloudflare_turnstile",
  "google_sheets",
  "abandoned_orders",
  "notifications",
  "message_order",
] as const;
export const MAX_PIXELS_PER_CONNECTEUR = 7;
const kind = z.enum(connecteurKinds);
const marketingKind = z.enum(["meta_capi", "tiktok_capi", "snapchat_capi"]);

export const connecteursRouter = router({
  list: protectedProcedure.query(({ ctx }) => listConnecteurs(getStoreId(ctx))),
  save: protectedProcedure
    .input(
      z
        .object({
          kind,
          label: z.string().trim().min(2).max(160),
          identifier: z.string().trim().max(255).optional(),
          secret: z.string().trim().max(2000).optional(),
          domain: z.string().trim().max(255).optional(),
          verificationCode: z.string().trim().max(2000).optional(),
          enabled: z.boolean(),
        })
        .superRefine((input, refinement) => {
          const requiresCredentials = [
            "meta_capi",
            "tiktok_capi",
            "snapchat_capi",
            "cloudflare_turnstile",
          ].includes(input.kind);
          if (
            (requiresCredentials || input.kind === "google_sheets") &&
            !input.identifier
          )
            refinement.addIssue({
              code: "custom",
              path: ["identifier"],
              message: "أدخل المعرّف المطلوب.",
            });
          if (requiresCredentials && !input.secret)
            refinement.addIssue({
              code: "custom",
              path: ["secret"],
              message: "أدخل بيانات الربط المطلوبة.",
            });
          if (input.kind === "facebook_domain" && !input.domain)
            refinement.addIssue({
              code: "custom",
              path: ["domain"],
              message: "أدخل النطاق.",
            });
        })
    )
    .mutation(({ ctx, input }) =>
      saveConnecteur(ctx.user.id, getStoreId(ctx), input)
    ),
  remove: protectedProcedure
    .input(z.object({ kind }))
    .mutation(({ ctx, input }) =>
      deleteConnecteur(getStoreId(ctx), input.kind)
    ),
  syncGoogleSheets: protectedProcedure
    .input(z.object({ spreadsheetId: z.string().trim().min(10).max(200) }))
    .mutation(({ ctx, input }) =>
      syncOrdersToGoogleSheet(getStoreId(ctx), input.spreadsheetId)
    ),
  turnstilePublic: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicTurnstileSiteKey(input.productId)),
  savePixels: protectedProcedure
    .input(
      z.object({
        kind: marketingKind,
        pixels: z
          .array(
            z.object({
              id: z.number().int().positive().optional(),
              label: z.string().trim().min(1).max(160),
              pixelId: z.string().trim().min(1).max(255),
              enabled: z.boolean(),
            })
          )
          .max(MAX_PIXELS_PER_CONNECTEUR),
      })
    )
    .mutation(({ ctx, input }) =>
      saveConnecteurPixels(getStoreId(ctx), input.kind, input.pixels)
    ),
  track: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        kind: marketingKind,
        eventName: z.enum(["PageView", "Lead", "Purchase"]),
        eventId: z.string().trim().min(8).max(160),
        value: z.number().nonnegative().optional(),
        currency: z.string().trim().max(8).default("DZD"),
        contentIds: z.array(z.string().max(80)).max(20).default([]),
        phone: z.string().trim().max(40).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const product = await getPublicStoreProduct(input.productId);
      if (!product?.storeId)
        return { success: false, configured: false } as const;
      const credentials = await getConnecteurPixelCredentials(
        product.storeId,
        input.kind
      );
      if (!credentials.length)
        return { success: false, configured: false } as const;
      try {
        await Promise.all(
          credentials.map(pixel =>
            sendConversionEvent(input.kind, pixel, input)
          )
        );
        return {
          success: true,
          configured: true,
          delivered: credentials.length,
        } as const;
      } catch (error) {
        console.warn("[Conversions] event delivery failed", error);
        return { success: false, configured: true, delivered: 0 } as const;
      }
    }),
});
