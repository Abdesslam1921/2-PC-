import { describe, expect, it } from "vitest";
import {
  STOREFRONT_TOKEN_CATALOG,
  isStorefrontTokenName,
  storefrontTokenVar,
} from "@shared/storefront/tokens";
import {
  storefrontThemeConfigSchema,
  validateStorefrontThemeConfig,
} from "@shared/storefront/themeSchema";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";

const TOKEN_NAME_PATTERN = /^--sf-[a-z0-9-]+$/;

describe("storefront design tokens — catalog", () => {
  const allNames = Object.values(STOREFRONT_TOKEN_CATALOG).flatMap(group =>
    Object.values(group)
  );

  it("exposes only namespaced --sf-* token names (structure, no values)", () => {
    expect(allNames.length).toBeGreaterThan(0);
    for (const name of allNames) {
      expect(name).toMatch(TOKEN_NAME_PATTERN);
    }
  });

  it("keeps every token name unique across categories", () => {
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  it("recognises canonical names and rejects foreign ones", () => {
    expect(isStorefrontTokenName("--sf-color-primary")).toBe(true);
    expect(isStorefrontTokenName("--primary")).toBe(false);
    expect(isStorefrontTokenName("color-primary")).toBe(false);
  });

  it("builds a var() reference for a token", () => {
    expect(storefrontTokenVar("--sf-color-primary")).toBe(
      "var(--sf-color-primary)"
    );
  });
});

describe("storefront theme schema — safety", () => {
  it("accepts a structured, safe payload", () => {
    const result = storefrontThemeConfigSchema.safeParse({
      colors: {
        "--sf-color-primary": "#0b5b43",
        "--sf-color-background": "oklch(0.98 0.005 100)",
      },
      radius: { "--sf-radius-lg": "1.25rem" },
      fontWeights: { "--sf-font-weight-bold": 700 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects CSS/JS injection attempts", () => {
    const injections = [
      "red; background:url(http://evil.test/x)",
      "1px} body{display:none",
      "javascript:alert(1)",
      "expression(alert(1))",
      "@import 'http://evil.test/x.css'",
    ];
    for (const value of injections) {
      const result = storefrontThemeConfigSchema.safeParse({
        colors: { "--sf-color-primary": value },
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects unknown token names and unknown top-level keys", () => {
    expect(
      storefrontThemeConfigSchema.safeParse({
        colors: { "--sf-color-nope": "#ffffff" },
      }).success
    ).toBe(false);
    expect(
      storefrontThemeConfigSchema.safeParse({ unknownGroup: {} }).success
    ).toBe(false);
  });

  it("rejects invalid enum values", () => {
    expect(
      storefrontThemeConfigSchema.safeParse({ density: "tiny" }).success
    ).toBe(false);
  });

  it("returns a safe fallback instead of throwing on invalid input", () => {
    const result = validateStorefrontThemeConfig("not-an-object");
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });
});

describe("storefront theme runtime — overrides", () => {
  it("returns only canonical --sf-* keys from a valid config", () => {
    const overrides = buildStorefrontTokenOverrides({
      colors: { "--sf-color-primary": "#123456" },
      spacing: { "--sf-space-md": "1rem" },
      radius: { "--sf-radius-lg": "1.25rem" },
    });
    expect(Object.keys(overrides).sort()).toEqual([
      "--sf-color-primary",
      "--sf-radius-lg",
      "--sf-space-md",
    ]);
    expect(overrides["--sf-color-primary"]).toBe("#123456");
  });

  it("returns an empty override set for invalid input (safe fallback)", () => {
    expect(
      buildStorefrontTokenOverrides({
        colors: { "--sf-color-primary": "red;url(http://x)" },
      })
    ).toEqual({});
    expect(buildStorefrontTokenOverrides(null)).toEqual({});
  });
});
