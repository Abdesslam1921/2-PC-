import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_RETENTION_POLICY,
  planStorefrontRetention,
} from "./storefrontRetention";

const versions = (count: number, startAt = 1) =>
  Array.from({ length: count }, (_, index) => ({
    versionNumber: startAt + index,
    publishedAt: new Date(2026, 0, startAt + index),
  }));

describe("planStorefrontRetention — explicit, non-silent policy", () => {
  it("keeps everything when under the count cap (nothing pruned)", () => {
    const plan = planStorefrontRetention({
      versions: versions(10),
      currentPublishedVersion: 10,
    });
    expect(plan.prune).toEqual([]);
    expect(plan.keep).toHaveLength(10);
    expect(plan.totalVersions).toBe(10);
  });

  it("caps retention at maxVersionsPerStore and marks only the overflow as prune candidates", () => {
    const plan = planStorefrontRetention({
      versions: versions(30),
      currentPublishedVersion: 30,
      policy: { maxVersionsPerStore: 10, minVersionsToKeep: 5, maxAgeDays: null },
    });
    // Newest 10 are kept (versions 21..30), the 20 older ones are candidates.
    expect(plan.keep.sort((a, b) => a - b)).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
    expect(plan.prune.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
  });

  it("always protects the current published version, even outside the count cap", () => {
    const plan = planStorefrontRetention({
      versions: versions(30),
      // A published pointer to an older version must never be pruned.
      currentPublishedVersion: 1,
      policy: { maxVersionsPerStore: 5, minVersionsToKeep: 5, maxAgeDays: null },
    });
    expect(plan.keep).toContain(1);
    expect(plan.prune).not.toContain(1);
    expect(plan.protectedVersions).toContain(1);
  });

  it("never prunes below the minVersionsToKeep floor (cap is clamped)", () => {
    const plan = planStorefrontRetention({
      versions: versions(30),
      currentPublishedVersion: 30,
      policy: { maxVersionsPerStore: 2, minVersionsToKeep: 8, maxAgeDays: null },
    });
    expect(plan.policy.maxVersionsPerStore).toBe(8);
    expect(plan.keep).toHaveLength(8);
    expect(plan.prune).toHaveLength(22);
  });

  it("keeps every version younger than maxAgeDays even when over the count cap", () => {
    const now = new Date(2026, 5, 1);
    const plan = planStorefrontRetention({
      versions: versions(30),
      currentPublishedVersion: 30,
      policy: { maxVersionsPerStore: 10, minVersionsToKeep: 5, maxAgeDays: 30 },
      now,
    });
    // Whatever the count cap says, nothing younger than 30 days is pruned.
    for (const versionNumber of plan.prune) {
      const published = new Date(2026, 0, versionNumber);
      const ageDays = (now.getTime() - published.getTime()) / 86_400_000;
      expect(ageDays).toBeGreaterThan(30);
    }
  });

  it("never empties history when there is at least one version", () => {
    const plan = planStorefrontRetention({
      versions: versions(3),
      currentPublishedVersion: null,
      policy: { maxVersionsPerStore: 0, minVersionsToKeep: 0, maxAgeDays: null },
    });
    expect(plan.keep.length).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty plan for a store with no versions", () => {
    const plan = planStorefrontRetention({
      versions: [],
      currentPublishedVersion: null,
    });
    expect(plan.keep).toEqual([]);
    expect(plan.prune).toEqual([]);
    expect(plan.totalVersions).toBe(0);
  });

  it("exposes the explicit default policy", () => {
    expect(DEFAULT_STOREFRONT_RETENTION_POLICY.maxVersionsPerStore).toBeGreaterThan(0);
    expect(
      DEFAULT_STOREFRONT_RETENTION_POLICY.minVersionsToKeep
    ).toBeLessThanOrEqual(DEFAULT_STOREFRONT_RETENTION_POLICY.maxVersionsPerStore);
  });
});
