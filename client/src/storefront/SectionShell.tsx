import {
  cloneElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

const FONT_STACKS: Record<string, string> = {
  cairo: '"Cairo", "Tajawal", system-ui, sans-serif',
  tajawal: '"Tajawal", "Cairo", system-ui, sans-serif',
  rubik: '"Rubik", "Tajawal", system-ui, sans-serif',
};

/**
 * Build inline styles from the common per-section style settings. Only safe
 * primitives are read; the schema already validated their shape.
 */
export function sectionStyleFromSettings(
  settings: Record<string, string | number | boolean>
): CSSProperties {
  const style: CSSProperties = {};
  const bg = settings.styleBg;
  const color = settings.styleText;
  const font = settings.styleFont;
  const padY = settings.stylePadY;
  const image = settings.styleImage;

  if (typeof bg === "string" && bg.trim()) style.backgroundColor = bg.trim();
  if (typeof color === "string" && color.trim()) style.color = color.trim();
  if (typeof font === "string" && FONT_STACKS[font]) {
    style.fontFamily = FONT_STACKS[font];
  }
  if (typeof padY === "number" && Number.isFinite(padY)) {
    style.paddingTop = `${padY}px`;
    style.paddingBottom = `${padY}px`;
  }
  const radius = settings.styleRadius;
  if (typeof radius === "number" && Number.isFinite(radius)) {
    style.borderRadius = `${radius}px`;
  }
  if (typeof image === "string" && image.trim()) {
    style.backgroundImage = `url(${image.trim()})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  return style;
}

export interface SectionShellProps {
  id: string;
  label: string;
  settings: Record<string, string | number | boolean>;
  highlight?: boolean;
  onSelect?: (id: string) => void;
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
  const styled =
    isValidElement(children) && Object.keys(applied).length > 0
      ? cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
          style: {
            ...((children as ReactElement<{ style?: CSSProperties }>).props
              .style ?? {}),
            ...applied,
          },
        })
      : children;

  const builderMode = Boolean(onSelect) || Boolean(highlight);
  if (!builderMode) return <Fragment>{styled}</Fragment>;

  return (
    <div
      id={`sf-sec-${id}`}
      className="relative"
      onClickCapture={
        onSelect
          ? event => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(id);
            }
          : undefined
      }
    >
      {styled}
      <div
        className="pointer-events-none absolute inset-0 z-40 border-2 transition"
        style={
          highlight
            ? { borderColor: "#0F766E", borderStyle: "dashed" }
            : { borderColor: "transparent" }
        }
      />
      {highlight && (
        <span className="pointer-events-none absolute right-3 top-2 z-40 rounded-md bg-[#0F766E] px-2.5 py-1 text-[10.5px] font-extrabold text-white shadow">
          {label}
        </span>
      )}
    </div>
  );
}
