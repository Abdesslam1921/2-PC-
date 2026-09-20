/**
 * Per-template default storefront token values.
 *
 * Injected on the storefront root BEFORE merchant theme overrides, so a store
 * with no theme customization keeps EXACTLY its current template look. They
 * also override the Phase 1 bridge in storefront.tokens.css.
 */
export const TEMPLATE_DEFAULT_TOKENS: Record<string, Record<string, string>> = {
  modern: {
    "--sf-color-accent-soft": "#FDF1DC",
    "--sf-color-surface-raised": "#0C2A26",
    "--sf-color-text-inverted": "#FFFFFF",
    "--sf-brand-fill":
      "linear-gradient(135deg,var(--sf-color-primary,#0F766E),var(--sf-color-primary-hover,#0B5D57))",
    "--sf-accent-fill":
      "linear-gradient(135deg,var(--sf-color-accent,#B45309),color-mix(in srgb,var(--sf-color-accent,#B45309) 62%,black))",
    "--sf-color-primary": "#0F766E",
    "--sf-color-primary-hover": "#0B5D57",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FFFCF6",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#B45309",
    "--sf-color-border": "#E6EEEB",
    "--sf-color-surface-muted": "#F3F7F6",
    "--sf-radius-lg": "22px",
  },
  minimal: {
    "--sf-color-accent-soft": "#F4F5F4",
    "--sf-color-surface-raised": "#0C2A26",
    "--sf-color-text-inverted": "#FFFFFF",
    "--sf-brand-fill":
      "linear-gradient(var(--sf-color-primary,#0F766E),var(--sf-color-primary,#0F766E))",
    "--sf-accent-fill": "none",
    "--sf-color-primary": "#0F766E",
    "--sf-color-primary-hover": "#0B5D57",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FFFFFF",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#0F766E",
    "--sf-color-border": "#E7E9E8",
    "--sf-color-surface-muted": "#F4F5F4",
    "--sf-radius-lg": "3px",
  },
  bold: {
    "--sf-color-accent-soft": "#F5B13D",
    "--sf-color-surface-raised": "#0C2A26",
    "--sf-color-text-inverted": "#FFFFFF",
    "--sf-brand-fill":
      "linear-gradient(var(--sf-color-primary,#F5B13D),var(--sf-color-primary,#F5B13D))",
    "--sf-accent-fill": "none",
    "--sf-color-primary": "#F5B13D",
    "--sf-color-primary-hover": "#E0A22F",
    "--sf-color-primary-foreground": "#0C2A26",
    "--sf-color-background": "#FFFFFF",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#0C2A26",
    "--sf-color-text-muted": "#576B66",
    "--sf-color-accent": "#F5B13D",
    "--sf-color-border": "#0C2A26",
    "--sf-color-surface-muted": "#DFF2EE",
    "--sf-radius-lg": "28px",
  },
  boutique: {
    "--sf-color-accent-soft": "#E9C77B",
    "--sf-color-surface-raised": "#2B211A",
    "--sf-color-text-inverted": "#FFFFFF",
    "--sf-brand-fill":
      "linear-gradient(var(--sf-color-primary,#2B211A),var(--sf-color-primary,#2B211A))",
    "--sf-accent-fill": "none",
    "--sf-color-primary": "#2B211A",
    "--sf-color-primary-hover": "#1F1813",
    "--sf-color-primary-foreground": "#FFFFFF",
    "--sf-color-background": "#FBF6EE",
    "--sf-color-surface": "#FFFFFF",
    "--sf-color-text": "#2B211A",
    "--sf-color-text-muted": "#6B5F52",
    "--sf-color-accent": "#B45309",
    "--sf-color-border": "#EADFCE",
    "--sf-color-surface-muted": "#F6EFE2",
    "--sf-radius-lg": "26px",
  },
};

export function templateDefaultTokens(templateKey: string): Record<string, string> {
  return TEMPLATE_DEFAULT_TOKENS[templateKey] ?? {};
}
