import { describe, expect, it } from "vitest";
import { sectionStyleFromSettings } from "./SectionShell";
import {
  validateStorefrontConfig,
  DEFAULT_MODERN_CONFIG,
  type StorefrontConfig,
} from "@shared/storefront/storefrontConfig";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";

const withSettings = (
  settings: Record<string, string | number | boolean>
): StorefrontConfig => {
  const config = JSON.parse(JSON.stringify(DEFAULT_MODERN_CONFIG)) as StorefrontConfig;
  config.sections[0] = { ...config.sections[0], settings };
  return config;
};

describe("per-section overrides", () => {
  it("applies a solid background and clears template gradients", () => {
    const style = sectionStyleFromSettings({ styleBgMode: "solid", styleBg: "#101010" });
    expect(style.backgroundColor).toBe("#101010");
    expect(style.backgroundImage).toBe("none");
  });

  it("builds a gradient from the two picks and the angle", () => {
    const style = sectionStyleFromSettings({
      styleBgMode: "gradient",
      styleGradientFrom: "#111111",
      styleGradientTo: "#222222",
      styleGradientAngle: 45,
    });
    expect(style.backgroundImage).toBe(
      "linear-gradient(45deg, #111111, #222222)"
    );
  });

  it("still honours a legacy background color without a mode", () => {
    const style = sectionStyleFromSettings({ styleBg: "#334455" });
    expect(style.backgroundColor).toBe("#334455");
  });

  it("lets a background image win over colors", () => {
    const style = sectionStyleFromSettings({
      styleBgMode: "solid",
      styleBg: "#101010",
      styleImage: "/hero.jpg",
    });
    expect(style.backgroundImage).toBe("url(/hero.jpg)");
  });

  it("scopes text, muted text and font overrides to the section", () => {
    const style = sectionStyleFromSettings({
      styleText: "#ffffff",
      styleTextMuted: "#cccccc",
      styleFont: "rubik",
    }) as Record<string, string>;
    expect(style["--sf-color-text"]).toBe("#ffffff");
    expect(style["--sf-color-text-muted"]).toBe("#cccccc");
    expect(style["--sf-font-heading"]).toContain("Rubik");
  });

  it("applies borders, radius and padding", () => {
    const style = sectionStyleFromSettings({
      styleBorderColor: "#000000",
      styleBorderWidth: 3,
      styleRadius: 18,
      stylePadY: 72,
    });
    expect(style.borderColor).toBe("#000000");
    expect(style.borderWidth).toBe("3px");
    expect(style.borderRadius).toBe("18px");
    expect(style.paddingTop).toBe("72px");
    expect(style.paddingBottom).toBe("72px");
  });
});

describe("strict validation of section style values", () => {
  it("accepts the structured overrides", () => {
    const result = validateStorefrontConfig(
      withSettings({
        styleBgMode: "gradient",
        styleGradientFrom: "#111111",
        styleGradientTo: "rgba(0,0,0,0.5)",
        styleGradientAngle: 120,
        styleText: "#ffffff",
        styleBorderColor: "oklch(0.5 0 0)",
        styleBorderWidth: 2,
        styleRadius: 12,
        stylePadY: "64px",
        styleFont: "cairo",
      })
    );
    expect(result.ok, result.message).toBe(true);
  });

  it("rejects malformed colors, lengths and enum values", () => {
    for (const settings of [
      { styleBg: "red; background-image: url(http://evil)" },
      { styleBgMode: "rainbow" },
      { styleBorderWidth: "abc" },
      { styleGradientAngle: -30 },
      { styleFont: "comic-sans" },
    ]) {
      const result = validateStorefrontConfig(withSettings(settings));
      expect(result.ok, JSON.stringify(settings)).toBe(false);
    }
  });
});

describe("global brand fill token", () => {
  it("maps the fills group to the brand fill variable", () => {
    const overrides = buildStorefrontTokenOverrides({
      fills: { "--sf-brand-fill": "none" },
    });
    expect(overrides["--sf-brand-fill"]).toBe("none");
  });

  it("accepts a gradient value built from the color tokens", () => {
    const overrides = buildStorefrontTokenOverrides({
      fills: {
        "--sf-brand-fill":
          "linear-gradient(135deg, var(--sf-color-primary), var(--sf-color-primary-hover))",
      },
    });
    expect(overrides["--sf-brand-fill"]).toContain("linear-gradient");
  });

  it("rejects unsafe fill values", () => {
    const overrides = buildStorefrontTokenOverrides({
      fills: { "--sf-brand-fill": "url(javascript:alert(1))" },
    });
    expect(overrides["--sf-brand-fill"]).toBeUndefined();
  });
});
