import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { SectionShell, type SectionShellProps } from "@/storefront/SectionShell";

/**
 * Drag-aware section wrapper used ONLY by the builder. It keeps dnd-kit out of
 * the public storefront bundle: the storefront uses `SectionShell` directly.
 */
export function BuilderSectionWrapper({
  id,
  label,
  settings,
  highlight,
  onSelect,
  children,
}: SectionShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      id={`sf-sec-${id}`}
      style={style}
      className={`relative ${
        highlight
          ? "outline-2 outline-dashed outline-[#0F766E] outline-offset-2"
          : ""
      }`}
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
      <SectionShell id={id} label={label} settings={settings}>
        {children}
      </SectionShell>
      <span className="absolute right-2 top-2 z-50 flex items-center gap-1.5 rounded-md bg-[#0F766E] px-2 py-1 text-[10.5px] font-extrabold text-white shadow">
        <button
          type="button"
          className="cursor-grab touch-none"
          aria-label="اسحب لإعادة الترتيب"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        {label}
      </span>
    </div>
  );
}
