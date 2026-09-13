import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOLD_CONFIG,
  DEFAULT_MINIMAL_CONFIG,
  DEFAULT_MODERN_CONFIG,
  storefrontConfigSchema,
  validateStorefrontConfig,
} from "@shared/storefront/storefrontConfig";

describe("storefront config schema", () => {
  it("accepts the default Modern config", () => {
    const result = validateStorefrontConfig(DEFAULT_MODERN_CONFIG);
    expect(result.ok).toBe(true);
    expect(result.data?.templateKey).toBe("modern");
    expect(result.data?.sections.length).toBeGreaterThan(0);
  });

  it("accepts the default Minimal config", () => {
    const result = validateStorefrontConfig(DEFAULT_MINIMAL_CONFIG);
    expect(result.ok).toBe(true);
    expect(result.data?.templateKey).toBe("minimal");
    expect(result.data?.sections.some(s => s.type === "product_grid")).toBe(true);
  });

  it("accepts the default Bold config", () => {
    const result = validateStorefrontConfig(DEFAULT_BOLD_CONFIG);
    expect(result.ok).toBe(true);
    expect(result.data?.templateKey).toBe("bold");
    expect(result.data?.sections.length).toBeGreaterThan(0);
  });

  it("rejects an unknown section type", () => {
    const bad = {
      ...DEFAULT_MODERN_CONFIG,
      sections: [
        { id: "x", type: "evil", enabled: true, order: 0, settings: {} },
      ],
    };
    expect(storefrontConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unsafe setting values (CSS/JS injection)", () => {
    const bad = {
      ...DEFAULT_MODERN_CONFIG,
      sections: [
        {
          id: "hero",
          type: "hero",
          enabled: true,
          order: 0,
          settings: { title: "a; background:url(http://evil)" },
        },
      ],
    };
    expect(storefrontConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown top-level keys and bad section ids", () => {
    expect(
      storefrontConfigSchema.safeParse({ ...DEFAULT_MODERN_CONFIG, extra: 1 })
        .success
    ).toBe(false);
    const badId = {
      ...DEFAULT_MODERN_CONFIG,
      sections: [
        { id: "Bad Id!", type: "hero", enabled: true, order: 0, settings: {} },
      ],
    };
    expect(storefrontConfigSchema.safeParse(badId).success).toBe(false);
  });
});
