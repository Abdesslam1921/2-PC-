import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";
import {
  createStorefrontVersion,
  getPublishedStorefront,
  getStorefrontDraft,
  getStorefrontVersionByNumber,
  listStorefrontVersions,
  recordStorefrontAuditLog,
  saveStorefrontDraft,
} from "../storefrontDb";
import {
  DEFAULT_MINIMAL_CONFIG,
  DEFAULT_MODERN_CONFIG,
  STOREFRONT_TEMPLATE_KEYS,
  validateStorefrontConfig,
} from "../../shared/storefront/storefrontConfig";

const TEMPLATE_DEFAULTS = {
  modern: DEFAULT_MODERN_CONFIG,
  minimal: DEFAULT_MINIMAL_CONFIG,
} as const;

/** Owner-only guard (admin override is allowed but always audited). */
function assertOwner(ctx: TrpcContext) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const storeId = getStoreId(ctx);
  const isOverride = ctx.store ? ctx.store.ownerId !== ctx.user.id : false;
  if (isOverride && ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "لا تملك صلاحية هذا المتجر.",
    });
  }
  return { storeId, isOverride, userId: ctx.user.id, role: ctx.user.role };
}

/** Seed the template's default draft and publish it immediately. */
async function seedAndPublishTemplate(input: {
  templateKey: (typeof STOREFRONT_TEMPLATE_KEYS)[number];
  storeId: number;
  userId: number;
  role: string;
  isOverride: boolean;
}) {
  const valid = validateStorefrontConfig(TEMPLATE_DEFAULTS[input.templateKey]);
  if (!valid.ok || !valid.data) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
  const existing = await getStorefrontDraft(input.storeId);
  await saveStorefrontDraft({
    ownerId: input.userId,
    storeId: input.storeId,
    configJson: JSON.stringify(valid.data),
    expectedVersion: existing ? existing.concurrencyVersion : 0,
    updatedBy: input.userId,
  });
  const { versionNumber } = await createStorefrontVersion({
    ownerId: input.userId,
    storeId: input.storeId,
    snapshotJson: JSON.stringify(valid.data),
    sourceDraftVersion: existing ? existing.concurrencyVersion + 1 : 1,
    publishedBy: input.userId,
    note: `enable ${input.templateKey}`,
  });
  await recordStorefrontAuditLog({
    storeId: input.storeId,
    actorId: input.userId,
    actorRole: input.role,
    isOverride: input.isOverride,
    action: "template_select",
    entityType: "template",
    toVersion: versionNumber,
    metadataJson: JSON.stringify({ templateKey: input.templateKey }),
  });
  return { versionNumber, templateKey: input.templateKey };
}

export const storefrontRouter = router({
  /** Public: the live storefront reads the latest PUBLISHED config only. */
  publicConfig: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.store) return null;
    const published = await getPublishedStorefront(ctx.store.id);
    if (!published) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(published.snapshotJson);
    } catch {
      console.warn("[storefront] invalid published snapshot JSON", ctx.store.id);
      return null;
    }
    const valid = validateStorefrontConfig(parsed);
    if (!valid.ok || !valid.data) {
      console.warn("[storefront] published config failed validation", ctx.store.id);
      return null;
    }
    return {
      templateKey: valid.data.templateKey,
      config: valid.data,
      storeName: ctx.store.name,
      versionNumber: published.versionNumber,
      publishedAt: published.publishedAt,
    };
  }),

  /** Owner: current draft + latest published + history. */
  managed: protectedProcedure.query(async ({ ctx }) => {
    const { storeId, isOverride } = assertOwner(ctx);
    const [draft, published, versions] = await Promise.all([
      getStorefrontDraft(storeId),
      getPublishedStorefront(storeId),
      listStorefrontVersions(storeId),
    ]);
    let draftConfig = null;
    if (draft) {
      try {
        const v = validateStorefrontConfig(JSON.parse(draft.configJson));
        draftConfig = v.ok ? v.data ?? null : null;
      } catch {
        draftConfig = null;
      }
    }
    return {
      isOverride,
      draft: draft
        ? { config: draftConfig, version: draft.concurrencyVersion }
        : null,
      published: published
        ? {
            versionNumber: published.versionNumber,
            publishedAt: published.publishedAt,
          }
        : null,
      versions,
    };
  }),

  saveDraft: protectedProcedure
    .input(
      z.object({
        config: z.unknown(),
        expectedVersion: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storeId, isOverride, userId, role } = assertOwner(ctx);
      const valid = validateStorefrontConfig(input.config);
      if (!valid.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: valid.message });
      }
      const result = await saveStorefrontDraft({
        ownerId: userId,
        storeId,
        configJson: JSON.stringify(valid.data),
        expectedVersion: input.expectedVersion,
        updatedBy: userId,
      });
      if (!result.conflict) {
        await recordStorefrontAuditLog({
          storeId,
          actorId: userId,
          actorRole: role,
          isOverride,
          action: "draft_save",
          entityType: "draft",
          metadataJson: JSON.stringify({ version: result.version }),
        });
      }
      return result;
    }),

  publish: protectedProcedure
    .input(z.object({ note: z.string().trim().max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, isOverride, userId, role } = assertOwner(ctx);
      const draft = await getStorefrontDraft(storeId);
      if (!draft) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا توجد مسودة للنشر.",
        });
      }
      const valid = validateStorefrontConfig(JSON.parse(draft.configJson));
      if (!valid.ok || !valid.data) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "المسودة غير صالحة للنشر.",
        });
      }
      const { versionNumber } = await createStorefrontVersion({
        ownerId: userId,
        storeId,
        snapshotJson: JSON.stringify(valid.data),
        sourceDraftVersion: draft.concurrencyVersion,
        publishedBy: userId,
        note: input.note ?? null,
      });
      await recordStorefrontAuditLog({
        storeId,
        actorId: userId,
        actorRole: role,
        isOverride,
        action: "publish",
        entityType: "version",
        toVersion: versionNumber,
        metadataJson: JSON.stringify({ templateKey: valid.data.templateKey }),
      });
      return { versionNumber };
    }),

  rollback: protectedProcedure
    .input(z.object({ versionNumber: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, isOverride, userId, role } = assertOwner(ctx);
      const source = await getStorefrontVersionByNumber(
        storeId,
        input.versionNumber
      );
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الإصدار غير موجود." });
      }
      const valid = validateStorefrontConfig(JSON.parse(source.snapshotJson));
      if (!valid.ok || !valid.data) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "الإصدار المصدر غير صالح.",
        });
      }
      // Rollback never mutates history: it creates a NEW equivalent version.
      const { versionNumber } = await createStorefrontVersion({
        ownerId: userId,
        storeId,
        snapshotJson: JSON.stringify(valid.data),
        sourceDraftVersion: null,
        publishedBy: userId,
        note: `rollback to v${input.versionNumber}`,
      });
      await recordStorefrontAuditLog({
        storeId,
        actorId: userId,
        actorRole: role,
        isOverride,
        action: "rollback",
        entityType: "version",
        fromVersion: input.versionNumber,
        toVersion: versionNumber,
      });
      return { versionNumber };
    }),

  /** One-click opt-in for any approved template (publishes immediately). */
  enableTemplate: protectedProcedure
    .input(z.object({ templateKey: z.enum(STOREFRONT_TEMPLATE_KEYS) }))
    .mutation(async ({ ctx, input }) => {
      const guard = assertOwner(ctx);
      return seedAndPublishTemplate({
        templateKey: input.templateKey,
        ...guard,
      });
    }),

  /** Backward-compatible alias: enable Modern. */
  enableModern: protectedProcedure.mutation(async ({ ctx }) => {
    const guard = assertOwner(ctx);
    return seedAndPublishTemplate({ templateKey: "modern", ...guard });
  }),
});
