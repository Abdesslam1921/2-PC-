import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import {
  DEFAULT_BOLD_CONFIG,
  DEFAULT_MINIMAL_CONFIG,
  DEFAULT_MODERN_CONFIG,
} from "../../shared/storefront/storefrontConfig";

const mocks = vi.hoisted(() => ({
  getPublishedStorefront: vi.fn(),
  getStorefrontDraft: vi.fn(),
  listStorefrontVersions: vi.fn(),
  listStorefrontVersionSnapshots: vi.fn(),
  saveStorefrontDraft: vi.fn(),
  createStorefrontVersion: vi.fn(),
  getStorefrontVersionByNumber: vi.fn(),
  recordStorefrontAuditLog: vi.fn(),
}));

vi.mock("../storefrontDb", () => ({
  getPublishedStorefront: mocks.getPublishedStorefront,
  getStorefrontDraft: mocks.getStorefrontDraft,
  listStorefrontVersions: mocks.listStorefrontVersions,
  listStorefrontVersionSnapshots: mocks.listStorefrontVersionSnapshots,
  saveStorefrontDraft: mocks.saveStorefrontDraft,
  createStorefrontVersion: mocks.createStorefrontVersion,
  getStorefrontVersionByNumber: mocks.getStorefrontVersionByNumber,
  recordStorefrontAuditLog: mocks.recordStorefrontAuditLog,
}));

import { appRouter } from "../routers";

function makeContext(storeId: number | null): TrpcContext {
  const store =
    storeId === null
      ? null
      : ({
          id: storeId,
          ownerId: 42,
          name: "متجر تجريبي",
          slug: "store-1",
          language: "dz-ar",
          templateId: null,
          aiStyleConfig: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TrpcContext["store"]);
  return {
    user: null,
    store,
    storeId,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function makeOwnerContext(storeId: number, userId = 42): TrpcContext {
  const ctx = makeContext(storeId);
  return {
    ...ctx,
    user: {
      id: userId,
      openId: "owner-open-id",
      name: "Owner",
      email: "owner@example.com",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
  };
}

describe("storefront.publicConfig tenant isolation", () => {
  it("returns null without a resolved store (fail-closed, never cross-tenant)", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    const result = await caller.storefront.publicConfig();
    expect(result).toBeNull();
    expect(mocks.getPublishedStorefront).not.toHaveBeenCalled();
  });

  const snapshotRow = (versionNumber: number, json: string) => ({
    versionNumber,
    snapshotJson: json,
    publishedAt: new Date(),
  });

  it("returns the published config for the resolved store only", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      snapshotRow(1, JSON.stringify(DEFAULT_MODERN_CONFIG)),
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(mocks.listStorefrontVersionSnapshots).toHaveBeenCalledWith(7);
    expect(result?.templateKey).toBe("modern");
  });

  it("serves the LAST GOOD previous version when the newest snapshot is corrupt", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      snapshotRow(3, "{not-json"),
      snapshotRow(2, JSON.stringify(DEFAULT_BOLD_CONFIG)),
      snapshotRow(1, JSON.stringify(DEFAULT_MODERN_CONFIG)),
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(result?.fallback).toBe(true);
    expect(result?.versionNumber).toBe(2);
    expect(result?.templateKey).toBe("bold");
  });

  it("serves the last good version when the newest fails validation", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      snapshotRow(3, JSON.stringify({ templateKey: "unknown-template", sections: [] })),
      snapshotRow(2, JSON.stringify(DEFAULT_MINIMAL_CONFIG)),
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(result?.fallback).toBe(true);
    expect(result?.templateKey).toBe("minimal");
    expect(result?.versionNumber).toBe(2);
  });

  it("falls back to Modern only when NO published version is valid", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      snapshotRow(3, "{not-json"),
      snapshotRow(2, JSON.stringify({ templateKey: "unknown-template", sections: [] })),
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(result).not.toBeNull();
    expect(result?.fallback).toBe(true);
    expect(result?.templateKey).toBe("modern");
    expect(result?.config.templateKey).toBe("modern");
    // Read-time fallback never mutates or deletes the immutable versions.
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });

  it("serves the real config (no fallback flag) when the newest snapshot is valid", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      snapshotRow(5, JSON.stringify(DEFAULT_MODERN_CONFIG)),
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(result?.fallback).toBe(false);
    expect(result?.versionNumber).toBe(5);
  });
});

/**
 * Regression: opening "Edit template" used to re-seed the draft with the
 * built-in defaults, so a template the merchant had already published (and
 * possibly customised) appeared as a stock design. Editing the ACTIVE
 * template must seed from its published design; every other template starts
 * from its built-in defaults.
 */
describe("storefront template seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const publishedBold = JSON.stringify({
    ...DEFAULT_BOLD_CONFIG,
    sections: DEFAULT_BOLD_CONFIG.sections.map(section =>
      section.type === "hero"
        ? { ...section, settings: { ...section.settings, title: "PUBLISHED BOLD HERO" } }
        : section
    ),
  });

  it("seeds the active template from its published design, not the defaults", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 39,
      snapshotJson: publishedBold,
      publishedAt: new Date(),
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MINIMAL_CONFIG),
      concurrencyVersion: 7,
    });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ version: 8 });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    const result = await caller.storefront.startEditing({ templateKey: "bold" });

    expect(result.seededFrom).toBe("published");
    expect(result.changed).toBe(true);
    const hero = result.config?.sections.find(section => section.type === "hero");
    expect(hero?.settings?.title).toBe("PUBLISHED BOLD HERO");
  });

  it("seeds a non-active template from its defaults, even if it was published before", async () => {
    // Active template is minimal, so bold must start clean.
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 39,
      snapshotJson: JSON.stringify(DEFAULT_MINIMAL_CONFIG),
      publishedAt: new Date(),
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MINIMAL_CONFIG),
      concurrencyVersion: 3,
    });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ version: 4 });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    const result = await caller.storefront.startEditing({ templateKey: "bold" });

    expect(result.seededFrom).toBe("defaults");
    expect(result.config?.templateKey).toBe("bold");
  });

  it("keeps an existing draft for the same template (unpublished work survives)", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify({
        ...DEFAULT_BOLD_CONFIG,
        theme: { colors: { "--sf-color-primary": "#101010" } },
      }),
      concurrencyVersion: 12,
    });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    const result = await caller.storefront.startEditing({ templateKey: "bold" });

    expect(result.changed).toBe(false);
    expect(result.seededFrom).toBe("draft");
    expect(result.version).toBe(12);
    expect(mocks.saveStorefrontDraft).not.toHaveBeenCalled();
    expect(mocks.getPublishedStorefront).not.toHaveBeenCalled();
  });

  it("template switch refuses to overwrite a newer draft (CONFLICT)", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 39,
      snapshotJson: JSON.stringify(DEFAULT_MINIMAL_CONFIG),
      publishedAt: new Date(),
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      concurrencyVersion: 3,
    });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({
      conflict: true,
      currentVersion: 4,
    });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    await expect(
      caller.storefront.startEditing({ templateKey: "bold" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.recordStorefrontAuditLog).not.toHaveBeenCalled();
  });

  it("activating the template that is already live changes nothing", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 41,
      snapshotJson: publishedBold,
      publishedAt: new Date(),
    });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    const result = await caller.storefront.enableTemplate({ templateKey: "bold" });

    expect(result.alreadyActive).toBe(true);
    expect(result.versionNumber).toBe(41);
    expect(mocks.saveStorefrontDraft).not.toHaveBeenCalled();
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });

  it("activating another template seeds that template's defaults", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 41,
      snapshotJson: publishedBold,
      publishedAt: new Date(),
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_BOLD_CONFIG),
      concurrencyVersion: 5,
    });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ version: 6 });
    mocks.createStorefrontVersion.mockResolvedValueOnce({ versionNumber: 42 });

    const caller = appRouter.createCaller(makeOwnerContext(30001));
    const result = await caller.storefront.enableTemplate({ templateKey: "modern" });

    expect(result.alreadyActive).toBe(false);
    expect(result.versionNumber).toBe(42);
    const savedConfig = JSON.parse(
      mocks.saveStorefrontDraft.mock.calls[0][0].configJson
    );
    expect(savedConfig.templateKey).toBe("modern");
    expect(savedConfig.theme).toEqual({});
  });
});

function makeForeignUserContext(storeId: number, userId = 999): TrpcContext {
  const ctx = makeContext(storeId);
  return {
    ...ctx,
    user: {
      id: userId,
      openId: "foreign-open-id",
      name: "Foreign",
      email: "foreign@example.com",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
  };
}

describe("storefront versions — immutability & draft/publish separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only ever INSERTs versions (no update/delete source path)", () => {
    const dbSource = readFileSync("server/storefrontDb.ts", "utf8");
    expect(dbSource).not.toMatch(/\.update\(\s*storefrontVersions\s*\)/);
    expect(dbSource).not.toMatch(/\.delete\(\s*storefrontVersions\s*\)/);
    expect(dbSource).toContain("db.insert(storefrontVersions)");

    const routerSource = readFileSync("server/routers/storefront.ts", "utf8");
    const rollbackBlock = routerSource.slice(
      routerSource.indexOf("rollback: protectedProcedure"),
      routerSource.indexOf("uploadAsset: protectedProcedure")
    );
    // Rollback must create a NEW version, never mutate or delete history.
    expect(rollbackBlock).toContain("createStorefrontVersion(");
    expect(rollbackBlock).not.toMatch(/\.delete\(/);
    expect(rollbackBlock).not.toMatch(/\.update\(/);
  });

  it("publicConfig reads published versions only, never the draft", async () => {
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      { versionNumber: 9, snapshotJson: JSON.stringify(DEFAULT_MODERN_CONFIG), publishedAt: new Date() },
    ]);
    const caller = appRouter.createCaller(makeContext(7));
    await caller.storefront.publicConfig();
    expect(mocks.listStorefrontVersionSnapshots).toHaveBeenCalledWith(7);
    expect(mocks.getStorefrontDraft).not.toHaveBeenCalled();
  });

  it("saveDraft never creates a published version", async () => {
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ conflict: false, version: 3 });
    const caller = appRouter.createCaller(makeOwnerContext(7));
    await caller.storefront.saveDraft({
      config: DEFAULT_MODERN_CONFIG,
      expectedVersion: 2,
    });
    expect(mocks.saveStorefrontDraft).toHaveBeenCalledTimes(1);
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });

  it("records an explicit force-save with a force flag in the audit log", async () => {
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ conflict: false, version: 10 });
    const caller = appRouter.createCaller(makeOwnerContext(7));
    await caller.storefront.saveDraft({
      config: DEFAULT_MODERN_CONFIG,
      expectedVersion: 9,
      force: true,
    });
    expect(mocks.recordStorefrontAuditLog).toHaveBeenCalledTimes(1);
    const audit = mocks.recordStorefrontAuditLog.mock.calls[0][0];
    expect(audit.action).toBe("draft_force_save");
    expect(JSON.parse(audit.metadataJson)).toMatchObject({
      forced: true,
      version: 10,
      expectedVersion: 9,
    });
  });

  it("keeps a normal save audited as draft_save (no force marker)", async () => {
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ conflict: false, version: 3 });
    const caller = appRouter.createCaller(makeOwnerContext(7));
    await caller.storefront.saveDraft({
      config: DEFAULT_MODERN_CONFIG,
      expectedVersion: 2,
    });
    const audit = mocks.recordStorefrontAuditLog.mock.calls[0][0];
    expect(audit.action).toBe("draft_save");
    expect(JSON.parse(audit.metadataJson).forced).toBe(false);
  });

  it("does not audit a forced save that lost a further race (CONFLICT)", async () => {
    mocks.saveStorefrontDraft.mockResolvedValueOnce({
      conflict: true,
      currentVersion: 11,
    });
    const caller = appRouter.createCaller(makeOwnerContext(7));
    const result = await caller.storefront.saveDraft({
      config: DEFAULT_MODERN_CONFIG,
      expectedVersion: 9,
      force: true,
    });
    expect(result).toEqual({ conflict: true, currentVersion: 11 });
    expect(mocks.recordStorefrontAuditLog).not.toHaveBeenCalled();
  });
});

describe("storefront.managed — published health for the merchant banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags the published history as degraded when the newest snapshot is corrupt", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce(null);
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 3,
      snapshotJson: "{broken",
      publishedAt: new Date(),
    });
    mocks.listStorefrontVersions.mockResolvedValueOnce([]);
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      { versionNumber: 3, snapshotJson: "{broken", publishedAt: new Date() },
      { versionNumber: 2, snapshotJson: JSON.stringify(DEFAULT_MODERN_CONFIG), publishedAt: new Date() },
    ]);

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.managed();

    expect(result.publishedHealth.ok).toBe(false);
    expect(result.publishedHealth.latestVersionNumber).toBe(3);
    expect(result.publishedHealth.servedVersionNumber).toBe(2);
    expect(result.publishedHealth.servedFallback).toBe(true);
    expect(result.publishedHealth.reason).toBeTruthy();
  });

  it("reports healthy when the newest snapshot is valid", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce(null);
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 4,
      snapshotJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      publishedAt: new Date(),
    });
    mocks.listStorefrontVersions.mockResolvedValueOnce([]);
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      { versionNumber: 4, snapshotJson: JSON.stringify(DEFAULT_MODERN_CONFIG), publishedAt: new Date() },
    ]);

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.managed();
    expect(result.publishedHealth.ok).toBe(true);
    expect(result.publishedHealth.servedVersionNumber).toBe(4);
    expect(result.publishedHealth.normalizationDrops).toBe(0);
  });

  it("exposes how many old values normalization dropped", async () => {
    const oldConfig: any = JSON.parse(JSON.stringify(DEFAULT_MODERN_CONFIG));
    oldConfig.theme = { density: "compact" };
    oldConfig.sections[0].visible = true;
    const json = JSON.stringify(oldConfig);
    mocks.getStorefrontDraft.mockResolvedValueOnce(null);
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 4,
      snapshotJson: json,
      publishedAt: new Date(),
    });
    mocks.listStorefrontVersions.mockResolvedValueOnce([]);
    mocks.listStorefrontVersionSnapshots.mockResolvedValueOnce([
      { versionNumber: 4, snapshotJson: json, publishedAt: new Date() },
    ]);

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.managed();
    expect(result.publishedHealth.ok).toBe(true);
    expect(result.publishedHealth.normalizationDrops).toBeGreaterThan(0);
  });
});

describe("storefront publish — immutable snapshot + audit + tenancy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publish creates a new immutable version scoped to the store and audits it", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      concurrencyVersion: 4,
    });
    mocks.createStorefrontVersion.mockResolvedValueOnce({ versionNumber: 4 });

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.publish({
      note: "go live",
      expectedDraftVersion: 4,
    });

    expect(result.versionNumber).toBe(4);
    expect(mocks.createStorefrontVersion).toHaveBeenCalledTimes(1);
    const arg = mocks.createStorefrontVersion.mock.calls[0][0];
    expect(arg.storeId).toBe(7);
    expect(arg.publishedBy).toBe(42);
    expect(arg.sourceDraftVersion).toBe(4);
    expect(JSON.parse(arg.snapshotJson).templateKey).toBe("modern");

    expect(mocks.recordStorefrontAuditLog).toHaveBeenCalledTimes(1);
    const audit = mocks.recordStorefrontAuditLog.mock.calls[0][0];
    expect(audit).toMatchObject({ storeId: 7, actorId: 42, action: "publish", toVersion: 4 });
  });

  it("publish refuses when there is no draft", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.publish({ expectedDraftVersion: 1 })
    ).rejects.toThrow(/مسودة/);
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });

  it("refuses to publish a draft version the editor never saw (stale draft)", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      concurrencyVersion: 5,
    });
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.publish({ expectedDraftVersion: 4 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
    expect(mocks.recordStorefrontAuditLog).not.toHaveBeenCalled();
  });

  it("maps a concurrent version-number race to CONFLICT, not 500", async () => {
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      concurrencyVersion: 4,
    });
    mocks.createStorefrontVersion.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), {
        code: "STOREFRONT_VERSION_CONFLICT",
      })
    );
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.publish({ expectedDraftVersion: 4 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.recordStorefrontAuditLog).not.toHaveBeenCalled();
  });

  it("a foreign non-admin user cannot publish or roll back", async () => {
    const caller = appRouter.createCaller(makeForeignUserContext(7, 999));
    await expect(
      caller.storefront.publish({ expectedDraftVersion: 1 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.storefront.rollback({ versionNumber: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
    expect(mocks.recordStorefrontAuditLog).not.toHaveBeenCalled();
  });
});

describe("storefront rollback — creates a new version, never mutates history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const v1Config = JSON.stringify({
    ...DEFAULT_MODERN_CONFIG,
    sections: DEFAULT_MODERN_CONFIG.sections.map(section =>
      section.type === "hero"
        ? { ...section, settings: { ...section.settings, title: "V1 HERO" } }
        : section
    ),
  });

  it("V1→V2→V3→rollback to V1 produces a NEW V4 equivalent to V1", async () => {
    mocks.getStorefrontVersionByNumber.mockResolvedValueOnce({
      versionNumber: 1,
      snapshotJson: v1Config,
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_BOLD_CONFIG),
      concurrencyVersion: 6,
    });
    mocks.createStorefrontVersion.mockResolvedValueOnce({ versionNumber: 4 });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({ conflict: false, version: 7 });

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.rollback({ versionNumber: 1 });

    expect(result.versionNumber).toBe(4);
    expect(result.config.templateKey).toBe("modern");
    const created = mocks.createStorefrontVersion.mock.calls[0][0];
    expect(created.storeId).toBe(7);
    expect(created.sourceDraftVersion).toBeNull();
    // The new version holds the same snapshot as V1 (history is copied, not moved).
    expect(JSON.parse(created.snapshotJson).sections.find((s: any) => s.type === "hero").settings.title).toBe(
      "V1 HERO"
    );
    expect(created.note).toContain("rollback to v1");

    const audit = mocks.recordStorefrontAuditLog.mock.calls[0][0];
    expect(audit).toMatchObject({
      storeId: 7,
      action: "rollback",
      fromVersion: 1,
      toVersion: 4,
    });
    // The draft is restored so the editor reflects the rolled-back config.
    expect(mocks.saveStorefrontDraft).toHaveBeenCalledTimes(1);
  });

  it("rollback never overwrites a newer draft: it reports the draft conflict", async () => {
    mocks.getStorefrontVersionByNumber.mockResolvedValueOnce({
      versionNumber: 1,
      snapshotJson: v1Config,
    });
    mocks.getStorefrontDraft.mockResolvedValueOnce({
      configJson: JSON.stringify(DEFAULT_BOLD_CONFIG),
      concurrencyVersion: 6,
    });
    mocks.createStorefrontVersion.mockResolvedValueOnce({ versionNumber: 4 });
    mocks.saveStorefrontDraft.mockResolvedValueOnce({
      conflict: true,
      currentVersion: 8,
    });

    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    const result = await caller.storefront.rollback({ versionNumber: 1 });

    // The publish (new immutable version) happened, but the newer draft stands.
    expect(result.versionNumber).toBe(4);
    expect(result.draftConflict).toBe(true);
    expect(result.draftVersion).toBe(8);
    expect(mocks.createStorefrontVersion).toHaveBeenCalledTimes(1);
    expect(mocks.saveStorefrontDraft).toHaveBeenCalledTimes(1);
    const audit = mocks.recordStorefrontAuditLog.mock.calls[0][0];
    expect(audit.metadataJson).toContain('"draftConflict":true');
  });

  it("rollback maps a concurrent version-number race to CONFLICT", async () => {
    mocks.getStorefrontVersionByNumber.mockResolvedValueOnce({
      versionNumber: 1,
      snapshotJson: v1Config,
    });
    mocks.createStorefrontVersion.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), {
        code: "STOREFRONT_VERSION_CONFLICT",
      })
    );
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.rollback({ versionNumber: 1 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.saveStorefrontDraft).not.toHaveBeenCalled();
  });

  it("rollback to a version that does not belong to the store is NOT_FOUND", async () => {
    mocks.getStorefrontVersionByNumber.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.rollback({ versionNumber: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getStorefrontVersionByNumber).toHaveBeenCalledWith(7, 99);
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });

  it("rollback refuses a corrupt source version without creating one", async () => {
    mocks.getStorefrontVersionByNumber.mockResolvedValueOnce({
      versionNumber: 2,
      snapshotJson: "{not-json",
    });
    const caller = appRouter.createCaller(makeOwnerContext(7, 42));
    await expect(
      caller.storefront.rollback({ versionNumber: 2 })
    ).rejects.toThrow();
    expect(mocks.createStorefrontVersion).not.toHaveBeenCalled();
  });
});
