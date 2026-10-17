/**
 * Storefront Design System — validated configuration schema.
 *
 * Phase 1 scope: STRUCTURE + NAMING + SAFETY only. This module intentionally
 * defines no default visual values. It guarantees that whatever a merchant
 * theme provides later (Phase 3/5) is structured data, never arbitrary
 * executable CSS/JS.
 *
 * Safety rules enforced here:
 * - Only canonical `--sf-*` token names are accepted (unknown keys rejected).
 * - Values must match a safe primitive (color / length / number / enum / safe
 *   string) and may not contain `; { } < > \ url( expression( javascript:` or
 *   `@import`, so no CSS/JS can be injected through configuration.
 * - The object is strict: extra keys fail validation instead of being stored.
 */

import { z } from "zod";
import {
  recordNormalizationDrop,
  type StorefrontNormalizationReport,
} from "./normalization";
import {
  STOREFRONT_GRID_STYLES,
  STOREFRONT_HERO_STRUCTURES,
  STOREFRONT_RADIUS_PHILOSOPHIES,
  STOREFRONT_TYPOGRAPHY_STYLES,
  storefrontBorderTokens,
  storefrontColorTokens,
  storefrontEffectTokens,
  storefrontFillTokens,
  storefrontFontFamilyTokens,
  storefrontFontScaleTokens,
  storefrontFontWeightTokens,
  storefrontLayoutTokens,
  storefrontLetterSpacingTokens,
  storefrontLineHeightTokens,
  storefrontRadiusTokens,
  storefrontShadowTokens,
  storefrontSpacingTokens,
} from "./tokens";

/** Disallowed constructs that could turn configuration into executable CSS/JS. */
const UNSAFE_VALUE_PATTERN =
  /[;<>{}\\<>]|url\s*\(|expression\s*\(|@import|javascript:/i;

const SAFE_CSS_VALUE_MESSAGE = "قيمة التوكن تحتوي على محتوى غير مسموح.";

function safeCssValue(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine(value => !UNSAFE_VALUE_PATTERN.test(value), SAFE_CSS_VALUE_MESSAGE);
}

const colorValueSchema = z
  .string()
  .trim()
  .max(120)
  .refine(value => !UNSAFE_VALUE_PATTERN.test(value), SAFE_CSS_VALUE_MESSAGE)
  .refine(
    value =>
      /^#[0-9a-fA-F]{3,8}$/.test(value) ||
      /^oklch\([^()]*\)$/.test(value) ||
      /^rgba?\([^()]*\)$/.test(value) ||
      /^hsla?\([^()]*\)$/.test(value) ||
      value === "transparent" ||
      value === "currentColor",
    "لون غير صالح. استخدم HEX أو oklch/rgb/hsl أو transparent/currentColor."
  );

const lengthValueSchema = safeCssValue(80);
const lineHeightValueSchema = safeCssValue(40);
const letterSpacingValueSchema = safeCssValue(40);
const shadowValueSchema = safeCssValue(300);
const fillValueSchema = safeCssValue(320);
const effectValueSchema = safeCssValue(160);
const fontFamilyValueSchema = safeCssValue(160);
const fontSizeValueSchema = safeCssValue(60);

const fontWeightValueSchema = z.number().int().min(100).max(900);

function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

/**
 * Partial record whose keys must belong to the given token-name allow-list.
 * Implemented with `z.record(string, ...)` + a key allow-list refinement
 * because `z.record(enum, ...)` in Zod v4 treats enum keys as exhaustive.
 */
function tokenRecord<T extends string>(
  values: readonly T[],
  valueSchema: z.ZodTypeAny
) {
  const allowed = new Set<string>(values);
  return z
    .record(z.string(), valueSchema)
    .superRefine((record, ctx) => {
      for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
          ctx.addIssue({
            code: "custom",
            message: `مفتاح توكن غير معروف: ${key}`,
          });
        }
      }
    });
}

const colorNames = Object.values(storefrontColorTokens);
const fillNames = Object.values(storefrontFillTokens);
const fontFamilyNames = Object.values(storefrontFontFamilyTokens);
const fontScaleNames = Object.values(storefrontFontScaleTokens);
const fontWeightNames = Object.values(storefrontFontWeightTokens);
const lineHeightNames = Object.values(storefrontLineHeightTokens);
const letterSpacingNames = Object.values(storefrontLetterSpacingTokens);
const spacingNames = Object.values(storefrontSpacingTokens);
const layoutNames = Object.values(storefrontLayoutTokens);
const borderNames = Object.values(storefrontBorderTokens);
const radiusNames = Object.values(storefrontRadiusTokens);
const shadowNames = Object.values(storefrontShadowTokens);
const effectNames = Object.values(storefrontEffectTokens);

/**
 * Full storefront theme configuration shape. Every group is optional and has
 * NO default values; a merchant either provides a value or the group is left
 * for the runtime fallback layer.
 */
export const storefrontThemeConfigSchema = z
  .strictObject({
    colors: tokenRecord(colorNames, colorValueSchema).optional(),
    /** Composite background-image values (solid or gradient) built from tokens. */
    fills: tokenRecord(fillNames, fillValueSchema).optional(),
    fontFamilies: tokenRecord(fontFamilyNames, fontFamilyValueSchema).optional(),
    fontScale: tokenRecord(fontScaleNames, fontSizeValueSchema).optional(),
    fontWeights: tokenRecord(fontWeightNames, fontWeightValueSchema).optional(),
    lineHeights: tokenRecord(lineHeightNames, lineHeightValueSchema).optional(),
    letterSpacings: tokenRecord(letterSpacingNames, letterSpacingValueSchema).optional(),
    spacing: tokenRecord(spacingNames, lengthValueSchema).optional(),
    layout: tokenRecord(layoutNames, lengthValueSchema).optional(),
    borders: tokenRecord(borderNames, lengthValueSchema).optional(),
    radius: tokenRecord(radiusNames, lengthValueSchema).optional(),
    shadows: tokenRecord(shadowNames, shadowValueSchema).optional(),
    effects: tokenRecord(effectNames, effectValueSchema).optional(),
  })
  .strict();

export type StorefrontThemeConfig = z.infer<typeof storefrontThemeConfigSchema>;

/**
 * Normalize a STORED theme payload before strict validation.
 *
 * Older published snapshots may carry theme groups/tokens that were later
 * removed or renamed (e.g. the `density` group). Instead of rejecting the whole
 * snapshot, this drops only the unknown groups / unknown token keys / values
 * that no longer satisfy the current schema, and keeps everything else intact.
 * Purely additive to validation: it never invents values.
 *
 * Every dropped group/token/value is appended to `report` (when provided) so
 * the server can log what normalization hid instead of losing it silently.
 */
export function normalizeStorefrontThemeConfig(
  input: unknown,
  report?: StorefrontNormalizationReport
): Record<string, unknown> {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    recordNormalizationDrop(report, {
      path: "theme",
      key: "theme",
      section: "theme",
      reason: "invalid-theme-payload",
      detail: Array.isArray(input) ? "array" : typeof input,
    });
    return {};
  }
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const groups: Array<[string, readonly string[], z.ZodTypeAny]> = [
    ["colors", colorNames, colorValueSchema],
    ["fills", fillNames, fillValueSchema],
    ["fontFamilies", fontFamilyNames, fontFamilyValueSchema],
    ["fontScale", fontScaleNames, fontSizeValueSchema],
    ["fontWeights", fontWeightNames, fontWeightValueSchema],
    ["lineHeights", lineHeightNames, lineHeightValueSchema],
    ["letterSpacings", letterSpacingNames, letterSpacingValueSchema],
    ["spacing", spacingNames, lengthValueSchema],
    ["layout", layoutNames, lengthValueSchema],
    ["borders", borderNames, lengthValueSchema],
    ["radius", radiusNames, lengthValueSchema],
    ["shadows", shadowNames, shadowValueSchema],
    ["effects", effectNames, effectValueSchema],
  ];
  const knownGroups = new Set(groups.map(([group]) => group));
  for (const group of Object.keys(src)) {
    if (knownGroups.has(group)) continue;
    recordNormalizationDrop(report, {
      path: `theme.${group}`,
      key: group,
      section: "theme",
      reason: "unknown-theme-group",
    });
  }
  for (const [group, allowedNames, valueSchema] of groups) {
    const value = src[group];
    if (value === undefined) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      recordNormalizationDrop(report, {
        path: `theme.${group}`,
        key: group,
        section: "theme",
        reason: "invalid-theme-group",
        detail: Array.isArray(value) ? "array" : typeof value,
      });
      continue;
    }
    const allowed = new Set<string>(allowedNames);
    const kept: Record<string, unknown> = {};
    for (const [key, tokenValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (!allowed.has(key)) {
        // removed/unknown token → drop
        recordNormalizationDrop(report, {
          path: `theme.${group}.${key}`,
          key,
          section: "theme",
          reason: "unknown-theme-token",
          detail: group,
        });
        continue;
      }
      if (valueSchema.safeParse(tokenValue).success) kept[key] = tokenValue;
      else
        recordNormalizationDrop(report, {
          path: `theme.${group}.${key}`,
          key,
          section: "theme",
          reason: "invalid-theme-value",
          detail: group,
        });
    }
    if (Object.keys(kept).length) out[group] = kept;
  }
  return out;
}

/** Structural profile of a template (named choices only, no visual values). */
export const storefrontTemplateProfileSchema = z
  .strictObject({
    radiusPhilosophy: enumOf(STOREFRONT_RADIUS_PHILOSOPHIES),
    heroStructure: enumOf(STOREFRONT_HERO_STRUCTURES),
    gridStyle: enumOf(STOREFRONT_GRID_STYLES),
    typographyStyle: enumOf(STOREFRONT_TYPOGRAPHY_STYLES),
  })
  .strict();

export type StorefrontTemplateProfileInput = z.infer<
  typeof storefrontTemplateProfileSchema
>;

export interface StorefrontThemeValidationResult {
  ok: boolean;
  data?: StorefrontThemeConfig;
  message?: string;
}

/**
 * Validate (never mutate) a merchant theme payload. Safe fallback contract:
 * invalid input returns `ok: false` instead of throwing, so callers can fall
 * back to the last valid configuration without deleting it.
 */
export function validateStorefrontThemeConfig(
  input: unknown
): StorefrontThemeValidationResult {
  const result = storefrontThemeConfigSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return {
    ok: false,
    message: first?.message ?? "إعدادات الثيم غير صالحة.",
  };
}
