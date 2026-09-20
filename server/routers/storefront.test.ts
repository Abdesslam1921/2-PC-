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
  saveStorefrontDraft: vi.fn(),
  createStorefrontVersion: vi.fn(),
  getStorefrontVersionByNumber: vi.fn(),
  recordStorefrontAuditLog: vi.fn(),
}));

vi.mock("../storefrontDb", () => ({
  getPublishedStorefront: mocks.getPublishedStorefront,
  getStorefrontDraft: mocks.getStorefrontDraft,
  listStorefrontVersions: mocks.listStorefrontVersions,
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

  it("returns the published config for the resolved store only", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 1,
      snapshotJson: JSON.stringify(DEFAULT_MODERN_CONFIG),
      publishedAt: new Date(),
    });
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(mocks.getPublishedStorefront).toHaveBeenCalledWith(7);
    expect(result?.templateKey).toBe("modern");
  });

  it("fails safe to null when the published snapshot is not valid", async () => {
    mocks.getPublishedStorefront.mockResolvedValueOnce({
      versionNumber: 1,
      snapshotJson: "{not-json",
      publishedAt: new Date(),
    });
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.storefront.publicConfig();
    expect(result).toBeNull();
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
