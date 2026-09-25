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
import { storagePut } from "../storage";
import { hasActiveBundle } from "../db";
import {
  STOREFRONT_TEMPLATE_KEYS,
  TEMPLATE_DEFAULT_CONFIGS,
  ensureOffersSection,
  validateStorefrontConfig,
} from "../../shared/storefront/storefrontConfig";
import type { StorefrontConfig } from "../../shared/storefront/storefrontConfig";

const TEMPLATE_DEFAULTS = TEMPLATE_DEFAULT_CONFIGS;

type TemplateKey = (typeof STOREFRONT_TEMPLATE_KEYS)[number];

/**
 * Seed config for a template.
 *
 * The ACTIVE (published) template keeps its live design when the merchant
 * re-opens it — the built-in defaults here were what made "Edit template"
 * show a stock design instead of the published one. Any other template seeds
 * from its built-in defaults, so every non-active template starts clean.
 */
async function templateSeedConfig(
  storeId: number,
  templateKey: TemplateKey,
  publishedSnapshotJson?: string | null
): Promise<{ config: StorefrontConfig; seededFrom: "published" | "defaults" }> {
  const snapshotJson =
    publishedSnapshotJson === undefined
      ? (await getPublishedStorefront(storeId))?.snapshotJson
      : publishedSnapshotJson;
  if (snapshotJson) {
    try {
      const valid = validateStorefrontConfig(JSON.parse(snapshotJson));
      if (valid.ok && valid.data && valid.data.templateKey === templateKey) {
        return { config: valid.data, seededFrom: "published" };
      }
    } catch {
      /* Corrupted snapshot: fall back to defaults instead of failing the edit. */
    }
  }
  return { config: TEMPLATE_DEFAULTS[templateKey], seededFrom: "defaults" };
}

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

/**
 * Activate a template: seed the draft with that template's LAST PUBLISHED
 * design (or its defaults if it was never published) and publish it.
 *
 * Activating the template that is already live is a no-op: it must never
 * overwrite the live design or an in-progress draft with stock defaults.
 */
async function seedAndPublishTemplate(input: {
  templateKey: TemplateKey;
  storeId: number;
  userId: number;
  role: string;
  isOverride: boolean;
}) {
  const currentPublished = await getPublishedStorefront(input.storeId);
  if (currentPublished) {
    try {
      const current = validateStorefrontConfig(
        JSON.parse(currentPublished.snapshotJson)
      );
      if (current.ok && current.data?.templateKey === input.templateKey) {
        return {
          versionNumber: currentPublished.versionNumber,
          templateKey: input.templateKey,
          alreadyActive: true,
        };
      }
    } catch {
      /* Unreadable snapshot: fall through and re-seed the template. */
    }
  }

  const seed = await templateSeedConfig(
    input.storeId,
    input.templateKey,
    currentPublished?.snapshotJson ?? null
  );
  const valid = validateStorefrontConfig(seed.config);
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
    note: `enable ${input.templateKey} (${seed.seededFrom})`,
  });
  await recordStorefrontAuditLog({
    storeId: input.storeId,
    actorId: input.userId,
    actorRole: input.role,
    isOverride: input.isOverride,
    action: "template_select",
    entityType: "template",
    toVersion: versionNumber,
    metadataJson: JSON.stringify({
      templateKey: input.templateKey,
      seededFrom: seed.seededFrom,
    }),
  });
  return { versionNumber, templateKey: input.templateKey, alreadyActive: false };
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
    let publishedTemplateKey: string | null = null;
    if (published) {
      try {
        const v = validateStorefrontConfig(JSON.parse(published.snapshotJson));
        publishedTemplateKey = v.ok ? v.data?.templateKey ?? null : null;
      } catch {
        publishedTemplateKey = null;
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
            templateKey: publishedTemplateKey,
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
      /**
       * A merchant who creates a bundle must get a "الباقات" section in the
       * storefront even if their config predates it (same principle as the
       * categories tiles). The section renders nothing while no bundle is
       * active, so it is harmless to always ensure it.
       */
      const publishConfig = (await hasActiveBundle(storeId))
        ? ensureOffersSection(valid.data)
        : valid.data;
      const { versionNumber } = await createStorefrontVersion({
        ownerId: userId,
        storeId,
        snapshotJson: JSON.stringify(publishConfig),
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
      // Also restore the DRAFT to the rolled-back config so the editor reflects it.
      const draft = await getStorefrontDraft(storeId);
      const saved = await saveStorefrontDraft({
        ownerId: userId,
        storeId,
        configJson: JSON.stringify(valid.data),
        expectedVersion: draft ? draft.concurrencyVersion : 0,
        updatedBy: userId,
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
      return {
        versionNumber,
        draftVersion: saved.version ?? 0,
        config: valid.data,
      };
    }),

  /** Upload a storefront asset (image) through the existing storage pipeline. */
  uploadAsset: protectedProcedure
    .input(
      z.object({
        fileName: z.string().trim().max(160),
        dataUrl: z.string().max(8_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storeId } = assertOwner(ctx);
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
        input.dataUrl
      );
      if (!match) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "صيغة الصورة غير صالحة.",
        });
      }
      const contentType = match[1].toLowerCase();
      if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "نوع الصورة غير مدعوم.",
        });
      }
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "حجم الصورة يتجاوز 5MB.",
        });
      }
      const safe =
        input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60) || "image";
      const key = `storefront/${storeId}/${Date.now()}-${safe}`;
      const { url } = await storagePut(key, buffer, contentType);
      return { url };
    }),

  /**
   * Preview-only: the validated default config of every approved template.
   * Read-only, never persisted — used to render real template previews.
   */
  templateDefaults: protectedProcedure.query(() => {
    const out: Record<string, unknown> = {};
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const valid = validateStorefrontConfig(TEMPLATE_DEFAULTS[key]);
      if (valid.ok && valid.data) out[key] = valid.data;
    }
    return out;
  }),

  /**
   * Open a template for editing: seeds the DRAFT (never publishes).
   *
   * - Draft already for this template  -> return it (keeps unpublished work).
   * - Otherwise seed from this template's LAST PUBLISHED design, so the editor
   *   shows what is actually live; built-in defaults only for a template that
   *   was never published.
   */
  startEditing: protectedProcedure
    .input(z.object({ templateKey: z.enum(STOREFRONT_TEMPLATE_KEYS) }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, isOverride, userId, role } = assertOwner(ctx);
      const existing = await getStorefrontDraft(storeId);
      let existingKey: string | null = null;
      let existingConfig: unknown = null;
      if (existing) {
        try {
          const v = validateStorefrontConfig(JSON.parse(existing.configJson));
          existingKey = v.ok ? v.data?.templateKey ?? null : null;
          existingConfig = v.ok ? v.data ?? null : null;
        } catch {
          existingKey = null;
        }
      }
      if (existing && existingKey === input.templateKey) {
        return {
          templateKey: input.templateKey,
          version: existing.concurrencyVersion,
          changed: false,
          seededFrom: "draft" as const,
          config: existingConfig,
        };
      }
      const seed = await templateSeedConfig(storeId, input.templateKey);
      const valid = validateStorefrontConfig(seed.config);
      if (!valid.ok || !valid.data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      const saved = await saveStorefrontDraft({
        ownerId: userId,
        storeId,
        configJson: JSON.stringify(valid.data),
        expectedVersion: existing ? existing.concurrencyVersion : 0,
        updatedBy: userId,
      });
      await recordStorefrontAuditLog({
        storeId,
        actorId: userId,
        actorRole: role,
        isOverride,
        action: "draft_template_switch",
        entityType: "draft",
        metadataJson: JSON.stringify({
          templateKey: input.templateKey,
          seededFrom: seed.seededFrom,
        }),
      });
      return {
        templateKey: input.templateKey,
        version: saved.version ?? 0,
        changed: true,
        seededFrom: seed.seededFrom,
        config: valid.data,
      };
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
