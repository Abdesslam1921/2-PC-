import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  logStorefrontNormalization,
  resetStorefrontNormalizationLogCacheForTests,
} from "./storefrontNormalizationLog";

describe("storefront normalization logging", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetStorefrontNormalizationLogCacheForTests();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("logs key, section, and reason for every dropped value", () => {
    logStorefrontNormalization("managed:published", 7, [
      {
        path: "sections[2].settings.styleRadius",
        key: "styleRadius",
        section: "hero",
        reason: "invalid-setting-value",
        detail: "length",
      },
      {
        path: "theme.density",
        key: "density",
        section: "theme",
        reason: "unknown-theme-group",
      },
    ]);

    expect(warn).toHaveBeenCalledTimes(2);
    const lines = warn.mock.calls.map(call => String(call[1]));
    expect(lines[0]).toContain('"key":"styleRadius"');
    expect(lines[0]).toContain('"section":"hero"');
    expect(lines[0]).toContain('"reason":"invalid-setting-value"');
    expect(lines[1]).toContain('"key":"density"');
    expect(lines[1]).toContain('"reason":"unknown-theme-group"');
  });

  it("never logs the dropped value itself", () => {
    logStorefrontNormalization("managed:published", 7, [
      {
        path: "sections[0].settings.secretCopy",
        key: "secretCopy",
        section: "hero",
        reason: "invalid-setting-value",
        detail: "length",
      },
    ]);
    const line = String(warn.mock.calls[0][1]);
    expect(line).not.toContain("secretCopyValue");
  });

  it("suppresses duplicate signatures (immutable snapshots are re-read often)", () => {
    const drop = {
      path: "theme.density",
      key: "density",
      section: "theme",
      reason: "unknown-theme-group" as const,
    };
    logStorefrontNormalization("publicConfig", 7, [drop]);
    logStorefrontNormalization("publicConfig", 7, [drop]);
    expect(warn).toHaveBeenCalledTimes(1);
    // A different store is a different event.
    logStorefrontNormalization("publicConfig", 8, [drop]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
