import { Fragment, type ReactNode } from "react";

/**
 * Wraps a storefront section for the builder.
 *
 * Public storefront: renders children untouched (no wrapper), so layout and
 * `position: sticky` are unaffected.
 * Builder: adds a relative wrapper that captures clicks (selects the section)
 * and draws a dashed highlight with a label.
 */
export function SectionShell({
  id,
  label,
  highlight,
  onSelect,
  children,
}: {
  id: string;
  label: string;
  highlight?: boolean;
  onSelect?: (id: string) => void;
  children: ReactNode;
}) {
  const builderMode = Boolean(onSelect) || Boolean(highlight);
  if (!builderMode) return <Fragment>{children}</Fragment>;
  return (
    <div
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
      {children}
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
