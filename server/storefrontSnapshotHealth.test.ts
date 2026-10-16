import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOLD_CONFIG,
  DEFAULT_MODERN_CONFIG,
  normalizeStorefrontConfig,
  validateStoredStorefrontConfig,
  validateStorefrontConfig,
} from "../shared/storefront/storefrontConfig";
import { evaluatePublishedSnapshots } from "./storefrontSnapshotHealth";

const row = (versionNumber: number, json: unknown, daysAgo = 0) => ({
  versionNumber,
  snapshotJson: typeof json === "string" ? json : JSON.stringify(json),
  publishedAt: new Date(Date.now() - daysAgo * 86_400_000),
});

/**
 * A realistic OLD snapshot: written before we removed `theme.density`, before we
 * retired the `styleRadius` per-section scale, and carrying section/item fields
 * that no longer exist. The strict validator must reject it; the normaliser must
 * clean it and make it valid WITHOUT inventing values.
 */
const oldSnapshot = () => {
  const config = JSON.parse(JSON.stringify(DEFAULT_MODERN_CONFIG));
  config.theme = {
    density: "compact", // removed theme group
    colors: { "--sf-color-primary": "#101010", "--sf-removed-token": "#fff" },
    unknownGroup: { foo: "bar" },
  };
  config.sections = config.sections.map((section: any) =>
    section.type === "hero"
      ? {
          ...section,
          visible: true, // retired section-level key
          settings: { ...section.settings, styleRadius: "large" }, // invalid now
        }
      : section
  );
  config.sections.push({
    id: "retired",
    type: "carousel", // retired section type
    enabled: true,
    order: 99,
    settings: {},
  });
  const benefits = config.sections.find((s: any) => s.type === "benefits");
  benefits.items[0].link = "/x"; // retired item key
  return config;
};

describe("normalizeStorefrontConfig — old snapshots stay valid", () => {
  it("the raw old snapshot is rejected by the strict validator", () => {
    expect(validateStorefrontConfig(oldSnapshot()).ok).toBe(false);
  });

  it("normalising the old snapshot makes it valid (no invented values)", () => {
    const result = validateStoredStorefrontConfig(oldSnapshot());
    expect(result.ok).toBe(true);
    expect(result.data?.templateKey).toBe("modern");
    // The retired section type is dropped, everything else survives.
    expect(result.data?.sections.some(s => (s.type as string) === "carousel")).toBe(
      false
    );
    expect(result.data?.sections.length).toBe(DEFAULT_MODERN_CONFIG.sections.length);
    // Kept the valid token, dropped the unknown one and the removed group.
    expect(result.data?.theme?.colors?.["--sf-color-primary"]).toBe("#101010");
    expect(
      (result.data?.theme as Record<string, unknown> | undefined)?.density
    ).toBeUndefined();
  });

  it("drops the invalid styleRadius value but keeps the valid section content", () => {
    const normalized = normalizeStorefrontConfig(oldSnapshot()) as any;
    const hero = normalized.sections.find((s: any) => s.type === "hero");
    expect(hero.settings.styleRadius).toBeUndefined();
    expect(hero.settings.title).toBeTruthy();
    expect(hero.visible).toBeUndefined();
    const benefits = normalized.sections.find((s: any) => s.type === "benefits");
    expect(benefits.items[0].link).toBeUndefined();
    expect(benefits.items[0].name).toBeTruthy();
  });

  it("a already-valid config is unchanged by normalisation", () => {
    const normalized = normalizeStorefrontConfig(DEFAULT_BOLD_CONFIG) as any;
    expect(normalized).toEqual(DEFAULT_BOLD_CONFIG);
  });
});

describe("evaluatePublishedSnapshots — last good version, Modern only as a last resort", () => {
  it("serves the newest published version when it is valid", () => {
    const { config, health, servedVersion } = evaluatePublishedSnapshots([
      row(3, DEFAULT_BOLD_CONFIG),
      row(2, DEFAULT_MODERN_CONFIG),
    ]);
    expect(health.ok).toBe(true);
    expect(health.servedFallback).toBe(false);
    expect(servedVersion?.versionNumber).toBe(3);
    expect(config?.templateKey).toBe("bold");
  });

  it("serves the newest EARLIER valid version when the newest is corrupt", () => {
    const { config, health, servedVersion } = evaluatePublishedSnapshots([
      row(3, "{not-json"),
      row(2, DEFAULT_BOLD_CONFIG),
      row(1, DEFAULT_MODERN_CONFIG),
    ]);
    expect(health.ok).toBe(false);
    expect(health.latestVersionNumber).toBe(3);
    expect(health.servedVersionNumber).toBe(2);
    expect(health.servedFallback).toBe(true);
    expect(health.reason).toBeTruthy();
    expect(config?.templateKey).toBe("bold");
    expect(servedVersion?.versionNumber).toBe(2);
  });

  it("resolves an OLD-format snapshot to the last good version instead of Modern", () => {
    const { config, health } = evaluatePublishedSnapshots([
      row(3, "{broken"),
      row(2, oldSnapshot()),
      row(1, DEFAULT_MODERN_CONFIG),
    ]);
    expect(health.servedVersionNumber).toBe(2);
    expect(config?.templateKey).toBe("modern");
  });

  it("falls back to Modern (config null) only when every version is invalid", () => {
    const { config, health, servedVersion } = evaluatePublishedSnapshots([
      row(2, "{not-json"),
      row(1, { templateKey: "unknown", sections: [] }),
    ]);
    expect(config).toBeNull();
    expect(servedVersion).toBeNull();
    expect(health.ok).toBe(false);
    expect(health.servedVersionNumber).toBeNull();
    expect(health.servedFallback).toBe(true);
  });

  it("returns an empty evaluation for a store with no versions", () => {
    const { config, health } = evaluatePublishedSnapshots([]);
    expect(config).toBeNull();
    expect(health.ok).toBe(false);
    expect(health.latestVersionNumber).toBeNull();
  });
});
