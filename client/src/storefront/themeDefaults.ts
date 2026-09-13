/**
 * Default storefront token values for the CURRENT template looks.
 *
 * These are injected on the storefront root BEFORE any merchant theme
 * overrides, so a store with no theme customization keeps exactly its current
 * appearance (and they override the Phase 1 bridge in storefront.tokens.css).
 * Values match the hardcoded colors used by the templates today.
 */
export const TEMPLATE_DEFAULT_TOKENS: Record<string, string> = {
  // Modern
  "--sf-color-primary": "#0F766E",
  "--sf-color-primary-hover": "#0B5D57",
  "--sf-color-primary-foreground": "#FFFFFF",
  "--sf-color-background": "#FFFCF6",
  "--sf-color-surface": "#FFFFFF",
  "--sf-color-text": "#0C2A26",
  "--sf-color-text-muted": "#576B66",
  "--sf-color-accent": "#B45309",
  "--sf-radius-lg": "22px",
};
