import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEMPLATE_DEFAULT_TOKENS } from "@/storefront/themeDefaults";

function source(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8"
  );
}

/**
 * Every editable Theme Editor color must actually reach the rendered
 * template. Before this contract, most templates hardcoded their colors, so
 * changing a token in the Theme Editor only recolored text.
 */
const EDITABLE_COLOR_TOKENS = [
  "--sf-color-primary,",
  "--sf-color-primary-hover",
  "--sf-color-background",
  "--sf-color-surface,",
  "--sf-color-text,",
  "--sf-color-text-muted",
  "--sf-color-accent",
] as const;

const TEMPLATES: Array<{ key: string; file: string }> = [
  { key: "modern", file: "./ModernStorefront.tsx" },
  { key: "minimal", file: "./MinimalStorefront.tsx" },
  { key: "bold", file: "./BoldStorefront.tsx" },
  { key: "boutique", file: "./BoutiqueStorefront.tsx" },
];

describe("storefront theme token coverage", () => {
  it.each(TEMPLATES)(
    "$key template consumes every editable color token",
    ({ file }) => {
      const template = source(file);
      for (const token of EDITABLE_COLOR_TOKENS) {
        expect(template).toContain(`var(${token}`);
      }
    }
  );

  it.each(TEMPLATES)(
    "$key template ships a default for every editable color token",
    ({ key }) => {
      const defaults = TEMPLATE_DEFAULT_TOKENS[key];
      expect(defaults, `missing defaults for ${key}`).toBeTruthy();
      for (const token of EDITABLE_COLOR_TOKENS) {
        const canonical = token.endsWith(",") ? token.slice(0, -1) : token;
        expect(defaults[canonical], `${key} is missing ${canonical}`).toMatch(
          /^#[0-9A-Fa-f]{3,8}$/
        );
      }
    }
  );
});
