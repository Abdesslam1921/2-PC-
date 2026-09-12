/**
 * Storefront Design System — Token Catalog.
 *
 * Phase 1 scope: token STRUCTURE and NAMING only.
 *
 * IMPORTANT — no visual VALUES live here on purpose. Hex colors, spacing
 * scales, radius numbers, font stacks and shadow recipes are decided in
 * Phase 2 from the approved reference analysis, then applied per store at
 * runtime (Phase 3/5). Adding literal values here would lock in a look we
 * have not approved yet.
 *
 * Isolation contract:
 * - Every variable is namespaced `--sf-*` (sf = storefront).
 * - Variables only resolve inside `[data-sf-root]` (see
 *   `client/src/styles/storefront.tokens.css`).
 * - Nothing in this catalog can leak into the Dashboard, which keeps using
 *   the global `:root` tokens in `client/src/index.css`.
 */

export const STOREFRONT_TOKEN_PREFIX = "--sf" as const;

/* ---------------------------------------------------------------------------
 * Semantic colors
 * ------------------------------------------------------------------------- */

export const storefrontColorTokens = {
  background: "--sf-color-background",
  surface: "--sf-color-surface",
  surfaceMuted: "--sf-color-surface-muted",
  surfaceRaised: "--sf-color-surface-raised",
  text: "--sf-color-text",
  textMuted: "--sf-color-text-muted",
  textInverted: "--sf-color-text-inverted",
  border: "--sf-color-border",
  borderStrong: "--sf-color-border-strong",
  primary: "--sf-color-primary",
  primaryForeground: "--sf-color-primary-foreground",
  primaryHover: "--sf-color-primary-hover",
  accent: "--sf-color-accent",
  accentForeground: "--sf-color-accent-foreground",
  success: "--sf-color-success",
  warning: "--sf-color-warning",
  danger: "--sf-color-danger",
  focusRing: "--sf-color-focus-ring",
  overlay: "--sf-color-overlay",
  price: "--sf-color-price",
  priceCompare: "--sf-color-price-compare",
  badgeDiscount: "--sf-color-badge-discount",
  badgeSoldOut: "--sf-color-badge-sold-out",
  announcementBackground: "--sf-color-announcement-background",
  announcementForeground: "--sf-color-announcement-foreground",
} as const;

/* ---------------------------------------------------------------------------
 * Typography
 * ------------------------------------------------------------------------- */

export const storefrontFontFamilyTokens = {
  heading: "--sf-font-heading",
  body: "--sf-font-body",
  price: "--sf-font-price",
} as const;

export const storefrontFontScaleTokens = {
  display: "--sf-text-display",
  h1: "--sf-text-h1",
  h2: "--sf-text-h2",
  h3: "--sf-text-h3",
  h4: "--sf-text-h4",
  bodyLg: "--sf-text-body-lg",
  body: "--sf-text-body",
  bodySm: "--sf-text-body-sm",
  caption: "--sf-text-caption",
  overline: "--sf-text-overline",
} as const;

export const storefrontFontWeightTokens = {
  regular: "--sf-font-weight-regular",
  medium: "--sf-font-weight-medium",
  semibold: "--sf-font-weight-semibold",
  bold: "--sf-font-weight-bold",
  black: "--sf-font-weight-black",
} as const;

export const storefrontLineHeightTokens = {
  tight: "--sf-leading-tight",
  snug: "--sf-leading-snug",
  normal: "--sf-leading-normal",
  relaxed: "--sf-leading-relaxed",
} as const;

export const storefrontLetterSpacingTokens = {
  tight: "--sf-tracking-tight",
  normal: "--sf-tracking-normal",
  wide: "--sf-tracking-wide",
  editorial: "--sf-tracking-editorial",
} as const;

/* ---------------------------------------------------------------------------
 * Spacing
 * ------------------------------------------------------------------------- */

export const storefrontSpacingTokens = {
  none: "--sf-space-none",
  xxs: "--sf-space-2xs",
  xs: "--sf-space-xs",
  sm: "--sf-space-sm",
  md: "--sf-space-md",
  lg: "--sf-space-lg",
  xl: "--sf-space-xl",
  xxl: "--sf-space-2xl",
  xxxl: "--sf-space-3xl",
  sectionTight: "--sf-space-section-tight",
  section: "--sf-space-section",
  sectionLoose: "--sf-space-section-loose",
} as const;

/* ---------------------------------------------------------------------------
 * Layout
 * ------------------------------------------------------------------------- */

export const storefrontLayoutTokens = {
  containerMax: "--sf-container-max",
  containerNarrow: "--sf-container-narrow",
  containerWide: "--sf-container-wide",
  gutterInline: "--sf-gutter-inline",
  sectionGap: "--sf-section-gap",
  headerHeight: "--sf-header-height",
  stickyOffset: "--sf-sticky-offset",
} as const;

/* ---------------------------------------------------------------------------
 * Borders
 * ------------------------------------------------------------------------- */

export const storefrontBorderTokens = {
  widthThin: "--sf-border-width-thin",
  widthBase: "--sf-border-width-base",
  widthStrong: "--sf-border-width-strong",
  style: "--sf-border-style",
} as const;

/* ---------------------------------------------------------------------------
 * Radius — naming only; the chosen philosophy is structural (Phase 3).
 * ------------------------------------------------------------------------- */

export const storefrontRadiusTokens = {
  none: "--sf-radius-none",
  sm: "--sf-radius-sm",
  md: "--sf-radius-md",
  lg: "--sf-radius-lg",
  xl: "--sf-radius-xl",
  pill: "--sf-radius-pill",
} as const;

/* ---------------------------------------------------------------------------
 * Shadows / effects
 * ------------------------------------------------------------------------- */

export const storefrontShadowTokens = {
  none: "--sf-shadow-none",
  soft: "--sf-shadow-soft",
  raised: "--sf-shadow-raised",
  floating: "--sf-shadow-floating",
  overlay: "--sf-shadow-overlay",
} as const;

export const storefrontEffectTokens = {
  surfaceBlur: "--sf-effect-surface-blur",
  imageZoom: "--sf-effect-image-zoom",
  transitionBase: "--sf-effect-transition-base",
  transitionEmphasis: "--sf-effect-transition-emphasis",
  motionDistance: "--sf-effect-motion-distance",
} as const;

/* ---------------------------------------------------------------------------
 * Density / structural philosophy — enum NAMES, not visual values.
 * ------------------------------------------------------------------------- */

export const STOREFRONT_DENSITIES = [
  "compact",
  "comfortable",
  "spacious",
] as const;

export const STOREFRONT_RADIUS_PHILOSOPHIES = [
  "sharp",
  "soft",
  "rounded",
  "pill",
] as const;

export const STOREFRONT_HERO_STRUCTURES = [
  "fullscreen-image",
  "split",
  "text-led",
] as const;

export const STOREFRONT_GRID_STYLES = [
  "border-based",
  "shadow-based",
  "borderless",
] as const;

export const STOREFRONT_TYPOGRAPHY_STYLES = [
  "editorial-bold",
  "balanced",
  "light-editorial",
] as const;

/* ---------------------------------------------------------------------------
 * Responsive rules — breakpoint NAMES only. Numeric values stay owned by the
 * existing Tailwind v4 setup so the storefront and dashboard share one grid
 * of breakpoints without duplicating magic numbers.
 * ------------------------------------------------------------------------- */

export const STOREFRONT_BREAKPOINT_NAMES = [
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
] as const;

/* ---------------------------------------------------------------------------
 * Catalog
 * ------------------------------------------------------------------------- */

export const STOREFRONT_TOKEN_CATALOG = {
  color: storefrontColorTokens,
  fontFamily: storefrontFontFamilyTokens,
  fontScale: storefrontFontScaleTokens,
  fontWeight: storefrontFontWeightTokens,
  lineHeight: storefrontLineHeightTokens,
  letterSpacing: storefrontLetterSpacingTokens,
  spacing: storefrontSpacingTokens,
  layout: storefrontLayoutTokens,
  border: storefrontBorderTokens,
  radius: storefrontRadiusTokens,
  shadow: storefrontShadowTokens,
  effect: storefrontEffectTokens,
} as const;

export type StorefrontTokenCategory = keyof typeof STOREFRONT_TOKEN_CATALOG;

type TokenGroupValues = (typeof STOREFRONT_TOKEN_CATALOG)[StorefrontTokenCategory];

/** Union of every canonical `--sf-*` variable name. */
export type StorefrontTokenName = TokenGroupValues[keyof TokenGroupValues];

/** Utility: `var(--sf-...)` reference for a canonical token name. */
export function storefrontTokenVar(name: StorefrontTokenName): string {
  return `var(${name})`;
}

const ALL_TOKEN_NAMES: ReadonlySet<string> = new Set(
  Object.values(STOREFRONT_TOKEN_CATALOG).flatMap(group =>
    Object.values(group)
  )
);

/** True only for canonical, namespaced storefront token names. */
export function isStorefrontTokenName(value: string): value is StorefrontTokenName {
  return ALL_TOKEN_NAMES.has(value);
}

/**
 * Structural identity/profile of a template. These are NAMED choices, not
 * visual values; Phase 3 maps each profile to concrete token values.
 */
export interface StorefrontTemplateProfile {
  density: (typeof STOREFRONT_DENSITIES)[number];
  radiusPhilosophy: (typeof STOREFRONT_RADIUS_PHILOSOPHIES)[number];
  heroStructure: (typeof STOREFRONT_HERO_STRUCTURES)[number];
  gridStyle: (typeof STOREFRONT_GRID_STYLES)[number];
  typographyStyle: (typeof STOREFRONT_TYPOGRAPHY_STYLES)[number];
}
