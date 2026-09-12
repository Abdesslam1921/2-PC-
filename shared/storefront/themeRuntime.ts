/**
 * Storefront Design System — runtime resolver.
 *
 * Phase 1 scope: STRUCTURE only. This module turns a validated theme config
 * into scoped `--sf-*` custom properties. It defines no visual values and no
 * defaults: an empty config yields an empty style object.
 *
 * Safe-fallback contract (Rule 12): invalid input never throws and never
 * deletes configuration — it returns an empty override object so the caller
 * can keep rendering with the last valid values.
 */

import {
  isStorefrontTokenName,
  type StorefrontTokenName,
} from "./tokens";
import {
  storefrontThemeConfigSchema,
  type StorefrontThemeConfig,
} from "./themeSchema";

/** Config groups that map directly to custom properties. `density` is an enum. */
const CONFIG_TOKEN_GROUPS = [
  "colors",
  "fontFamilies",
  "fontScale",
  "fontWeights",
  "lineHeights",
  "letterSpacings",
  "spacing",
  "layout",
  "borders",
  "radius",
  "shadows",
  "effects",
] as const satisfies ReadonlyArray<keyof StorefrontThemeConfig>;

export type StorefrontTokenOverrides = Partial<
  Record<StorefrontTokenName, string>
>;

function coerceValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Build the scoped custom-property overrides for a storefront root.
 * Returns only canonical `--sf-*` keys; unsafe/unknown keys are ignored.
 */
export function buildStorefrontTokenOverrides(
  input: unknown
): StorefrontTokenOverrides {
  const parsed = storefrontThemeConfigSchema.safeParse(input);
  if (!parsed.success) return {};

  const overrides: Record<string, string> = {};
  const config: StorefrontThemeConfig = parsed.data;

  for (const groupKey of CONFIG_TOKEN_GROUPS) {
    const group = config[groupKey];
    if (!group || typeof group !== "object") continue;

    for (const [tokenName, rawValue] of Object.entries(
      group as Record<string, unknown>
    )) {
      const value = coerceValue(rawValue);
      if (value === null) continue;
      // Defense in depth: the schema already restricted this group's keys to
      // its canonical token names; re-check globally before emitting.
      if (!isStorefrontTokenName(tokenName)) continue;
      overrides[tokenName] = value;
    }
  }

  return overrides as StorefrontTokenOverrides;
}
