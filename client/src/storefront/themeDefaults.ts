/**
 * Per-template default storefront token values.
 *
 * Injected on the storefront root BEFORE merchant theme overrides, so a store
 * with no theme customization keeps EXACTLY its current template look. They
 * also override the Phase 1 bridge in storefront.tokens.css.
 */
export const TEMPLATE_DEFAULT_TOKENS: Record<string, Record<string, string>> = {
  modern: {
    "--sf-color-primary": "#0F766E",
    "--sf-color-primary-hover": "#0B5D57",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FFFCF6",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#B45309",
    "--sf-radius-lg": "22px",
  },
  minimal: {
    "--sf-color-primary": "#0F766E",
    "--sf-color-primary-hover": "#0B5D57",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FFFFFF",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#0F766E",
    "--sf-radius-lg": "3px",
  },
  bold: {
    "--sf-color-primary": "#F5B13D",
    "--sf-color-primary-hover": "#E0A22F",
    "--sf-color-primary-foreground": "#0C2A26",
    "--sf-color-background": "#FFFFFF",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#0F766E",
    "--sf-radius-lg": "28px",
  },
  boutique: {
    "--sf-color-primary": "#2B211A",
    "--sf-color-primary-hover": "#1F1813",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FBF6EE",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#2B211A",
    "--sf-color-text-muted": "#6B5F52",
    "--sf-color-accent": "#B45309",
    "--sf-radius-lg": "26px",
  },
};

export function templateDefaultTokens(templateKey: string): Record<string, string> {
  return TEMPLATE_DEFAULT_TOKENS[templateKey] ?? {};
}
