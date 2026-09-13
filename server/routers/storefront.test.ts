import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { DEFAULT_MODERN_CONFIG } from "../../shared/storefront/storefrontConfig";

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
