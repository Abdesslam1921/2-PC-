import {
  cloneElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

const FONT_STACKS: Record<string, string> = {
  cairo: '"Cairo", "Tajawal", system-ui, sans-serif',
  tajawal: '"Tajawal", "Cairo", system-ui, sans-serif',
  rubik: '"Rubik", "Tajawal", system-ui, sans-serif',
};

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Per-section overrides.
 *
 * Everything here is an OVERRIDE of the global theme for this one section:
 * color/font overrides are emitted as scoped `--sf-*` variables on the section
 * element, so the whole subtree (cards, buttons, muted text) follows them while
 * every other section keeps the theme. Precedence:
 * section override → theme token → template default.
 *
 * Values are safe primitives validated by the config schema; no free CSS.
 */
export function sectionStyleFromSettings(
  settings: Record<string, string | number | boolean>
): CSSProperties {
  const style: Record<string, string | number> = {};

  const image = str(settings.styleImage);
  const bg = str(settings.styleBg);
  const mode = str(settings.styleBgMode);
  const from = str(settings.styleGradientFrom);
  const to = str(settings.styleGradientTo);
  const angle = num(settings.styleGradientAngle) ?? 135;

  if (image) {
    style.backgroundImage = `url(${image})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (mode === "gradient" && (from || to)) {
    const start = from || "transparent";
    const end = to || from || "transparent";
    style.backgroundImage = `linear-gradient(${angle}deg, ${start}, ${end})`;
    if (from) style.backgroundColor = from;
  } else if ((mode === "solid" || (mode === "" && bg)) && bg) {
    style.backgroundColor = bg;
    // Override template gradients so the chosen background is visible.
    style.backgroundImage = "none";
  }

  // Scoped text + font overrides (cascade over the whole section).
  const text = str(settings.styleText);
  const textMuted = str(settings.styleTextMuted);
  const font = str(settings.styleFont);
  if (text) {
    style["--sf-color-text"] = text;
    // Dark bands paint with the inverted token; a section-level "text color"
    // must move those too, otherwise the visible text never changes.
    style["--sf-color-text-inverted"] = text;
  }
  if (textMuted) style["--sf-color-text-muted"] = textMuted;
  if (font && FONT_STACKS[font]) {
    style["--sf-font-heading"] = FONT_STACKS[font];
    style["--sf-font-body"] = FONT_STACKS[font];
    // The root only READS the font token, so redefining the variable inside a
    // section changes nothing (inheritance passes the computed family). Apply
    // the family directly on the section element.
    style.fontFamily = FONT_STACKS[font];
  }

  const borderColor = str(settings.styleBorderColor);
  const borderWidth = num(settings.styleBorderWidth);
  const radius = num(settings.styleRadius);
  if (borderColor || borderWidth !== null) {
    // A color without a width renders nothing: give the border a visible
    // default so "لون الحدود" alone actually shows up.
    style.borderStyle = "solid";
    if (borderWidth !== null) style.borderWidth = `${borderWidth}px`;
    else if (borderColor) style.borderWidth = "1px";
    if (borderColor) style.borderColor = borderColor;
  }
  if (radius !== null) style.borderRadius = `${radius}px`;

  const padY = num(settings.stylePadY);
  if (padY !== null) {
    style.paddingTop = `${padY}px`;
    style.paddingBottom = `${padY}px`;
  }

  return style as CSSProperties;
}

export interface SectionShellProps {
  id: string;
  label: string;
  settings: Record<string, string | number | boolean>;
  highlight?: boolean;
  /**
   * Builder-only selection callback. The optional second argument is the
   * exact setting the merchant clicked inside the section (text/image/
   * background), resolved against the section's own validated settings — so
   * the panel can open that field directly. It is never a free-form value.
   */
  onSelect?: (id: string, fieldKey?: string | null) => void;
  children: ReactNode;
}

/** Pluggable wrapper: the builder passes a drag-aware wrapper; storefront uses SectionShell. */
export type SectionWrapperComponent = (props: SectionShellProps) => ReactElement;

/**
 * Wraps a storefront section.
 *
 * - Applies common style settings to the section element itself (via
 *   `cloneElement`), so it works in BOTH the public storefront and the builder
 *   without a wrapper div (which would break `position: sticky`).
 * - In the builder it additionally captures clicks and draws a highlight.
 */
export function SectionShell({
  id,
  label,
  settings,
  highlight,
  onSelect,
  children,
}: SectionShellProps) {
  const applied = sectionStyleFromSettings(settings);
  // Theme-level tokens applied to the section element. The `revert-layer`
  // fallback means: when the merchant sets no theme value, the declaration is
  // dropped and the template's own styles apply unchanged.
  const themeBase: CSSProperties = {
    paddingTop: "var(--sf-space-section, revert-layer)",
    paddingBottom: "var(--sf-space-section, revert-layer)",
    transitionDuration: "var(--sf-effect-transition-base, revert-layer)",
  };
  const merged = { ...themeBase, ...applied };
  const styled =
    isValidElement(children) && Object.keys(merged).length > 0
      ? cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
          style: {
            ...themeBase,
            ...((children as ReactElement<{ style?: CSSProperties }>).props
              .style ?? {}),
            ...applied,
          },
        })
      : children;

  const builderMode = Boolean(onSelect) || Boolean(highlight);
  if (!builderMode) return <Fragment>{styled}</Fragment>;

  /**
   * Resolve which setting the merchant clicked inside the section.
   *
   * Returns either a section setting key (matched by EXACT text against the
   * section's validated settings) or a theme token name for the section
   * background. Both are schema-defined — never an arbitrary value.
   */
  const resolveFieldKey = (event: ReactMouseEvent, wrapper: HTMLElement) => {
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    if (target.tagName === "IMG") return "imageUrl";

    const text = (target.textContent ?? "").trim();
    if (text && text.length <= 300) {
      const match = Object.entries(settings).find(
        ([, value]) => typeof value === "string" && value.trim() === text
      );
      if (match) return match[0];
    }

    // Clicking the section itself (its padding/background) edits the section's
    // own background override, which lives in the section settings dialog.
    const root = wrapper.firstElementChild as HTMLElement | null;
    if (target === wrapper || target === root) return "styleBg";
    return null;
  };

  return (
    <div
      id={`sf-sec-${id}`}
      className="relative"
      onClickCapture={
        onSelect
          ? event => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(id, resolveFieldKey(event, event.currentTarget));
            }
          : undefined
      }
    >
      {styled}
      {/* Editor highlight: a thick dashed brand border with a white halo, so it
          stays visible on sections whose own background uses the same color
          (teal hero, dark footer, image-backed sections). */}
      <div
        className="pointer-events-none absolute inset-0 z-40"
        style={
          highlight
            ? {
                border: "3px dashed #0F766E",
                boxShadow:
                  "0 0 0 2px rgba(255,255,255,0.95), inset 0 0 0 2px rgba(255,255,255,0.6)",
              }
            : undefined
        }
      />
      {highlight && (
        <span className="pointer-events-none absolute right-3 top-2 z-40 rounded-md bg-[#0F766E] px-2.5 py-1 text-[10.5px] font-extrabold text-white shadow ring-2 ring-white">
          {label}
        </span>
      )}
    </div>
  );
}
