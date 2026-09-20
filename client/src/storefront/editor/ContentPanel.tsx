import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADDABLE_SECTION_TYPES,
  SECTION_LABELS,
} from "@shared/storefront/sectionFields";
import { templateDefaultSection } from "@shared/storefront/storefrontConfig";
import type {
  StorefrontConfig,
  StorefrontSection,
  StorefrontSectionType,
} from "@shared/storefront/storefrontConfig";

const sortSections = (sections: StorefrontSection[]) =>
  [...sections].sort((a, b) => a.order - b.order);
const reindex = (list: StorefrontSection[]) =>
  list.map((s, i) => ({ ...s, order: i }));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

/**
 * One row = a single big control that opens the section editor, with the
 * quick actions kept as real (separate) buttons so nested interactive elements
 * stay valid and keyboard accessible.
 */
function SectionRow({
  section,
  active,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
  onReset,
}: {
  section: StorefrontSection;
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      title="افتح إعدادات القسم"
      className={`flex cursor-pointer items-center gap-2 border-b border-[#f1f3f2] px-3 py-2.5 text-[13px] font-bold outline-none transition hover:bg-[#f7faf9] focus-visible:bg-[#f7faf9] ${
        active ? "bg-[#e4f3ef] text-[#0B5D57]" : "text-[#2f433f]"
      }`}
    >
      <button
        type="button"
        className="touch-none text-[#9fb0ac]"
        aria-label="سحب لإعادة الترتيب"
        onClick={event => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 whitespace-normal text-right">
        {SECTION_LABELS[section.type]}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={stop(onToggle)}
          title={section.enabled ? "إخفاء" : "إظهار"}
          className="grid size-7 place-items-center rounded-md text-[#7b8a86] hover:bg-white"
        >
          {section.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={stop(onDuplicate)}
          title="تكرار"
          className="grid size-7 place-items-center rounded-md text-[#7b8a86] hover:bg-white"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stop(onReset)}
          title="إعادة تعيين القسم إلى الافتراضي"
          className="grid size-7 place-items-center rounded-md text-[#0F766E] hover:bg-white"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stop(onDelete)}
          title="حذف"
          className="grid size-7 place-items-center rounded-md text-[#b03a2e] hover:bg-white"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <span className="text-[12px] text-[#9fb0ac]">›</span>
    </div>
  );
}

export function ContentPanel({
  config,
  onChange,
  selectedSectionId,
  onSelectSection,
  onEditSection,
}: {
  config: StorefrontConfig;
  onChange: (next: StorefrontConfig) => void;
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  /** Opens the section settings editor (dialog on desktop, full-screen on mobile). */
  onEditSection: (id: string) => void;
}) {
  const sections = useMemo(() => sortSections(config.sections), [config.sections]);
  const [addType, setAddType] = useState<StorefrontSectionType>("hero");

  const patch = (id: string, p: Partial<StorefrontSection>) =>
    onChange({
      ...config,
      sections: config.sections.map(s => (s.id === id ? { ...s, ...p } : s)),
    });

  const resetSection = (id: string) => {
    const section = config.sections.find(s => s.id === id);
    if (!section) return;
    const fallback = templateDefaultSection(config.templateKey, section);
    patch(id, {
      settings: { ...(fallback?.settings ?? {}) },
      items: fallback?.items ? [...fallback.items] : undefined,
    });
  };

  const moveById = (fromId: string, toId: string) => {
    const list = sortSections(config.sections);
    const from = list.findIndex(s => s.id === fromId);
    const to = list.findIndex(s => s.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    onChange({ ...config, sections: reindex(arrayMove(list, from, to)) });
  };

  const addSection = () => {
    const id = `${addType}-${Date.now().toString(36)}`;
    const next: StorefrontSection = {
      id,
      type: addType,
      enabled: true,
      order: config.sections.length,
      settings: {},
    };
    onChange({ ...config, sections: reindex([...sections, next]) });
    onSelectSection(id);
    onEditSection(id);
  };

  const duplicateSection = (id: string) => {
    const list = sortSections(config.sections);
    const index = list.findIndex(s => s.id === id);
    if (index < 0) return;
    const clone: StorefrontSection = { ...list[index], id: newId(list[index].type) };
    list.splice(index + 1, 0, clone);
    onChange({ ...config, sections: reindex(list) });
    onSelectSection(clone.id);
  };

  const deleteSection = (id: string) => {
    const list = sortSections(config.sections).filter(s => s.id !== id);
    onChange({ ...config, sections: reindex(list) });
    if (selectedSectionId === id) onSelectSection(list[0]?.id ?? "");
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) moveById(String(active.id), String(over.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between px-3.5 py-3">
        <span className="text-[13.5px] font-black">أقسام المتجر</span>
        <span className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[11px] font-bold text-[#0B5D57]">
          {sections.length}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(section => (
            <SectionRow
              key={section.id}
              section={section}
              active={section.id === selectedSectionId}
              onEdit={() => {
                onSelectSection(section.id);
                onEditSection(section.id);
              }}
              onToggle={() => patch(section.id, { enabled: !section.enabled })}
              onDuplicate={() => duplicateSection(section.id)}
              onDelete={() => deleteSection(section.id)}
              onReset={() => resetSection(section.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 p-3">
        <select
          value={addType}
          onChange={e => setAddType(e.target.value as StorefrontSectionType)}
          className="h-9 flex-1 rounded-lg border border-[#e7e9e8] bg-white px-2 text-xs font-bold"
        >
          {ADDABLE_SECTION_TYPES.map(t => (
            <option key={t} value={t}>
              {SECTION_LABELS[t]}
            </option>
          ))}
        </select>
        <Button onClick={addSection} className="h-9 rounded-lg px-3 text-xs font-extrabold">
          <Plus className="ml-1 size-4" /> إضافة
        </Button>
      </div>

      <p className="px-3.5 pb-3 text-[11.5px] leading-6 text-[#576B66]">
        اضغط على أي قسم لفتح إعداداته، أو اضغط على عنصر داخل المعاينة للوصول
        مباشرة لحقله. إعدادات القسم هي تجاوزات فوق الثيم العام.
      </p>
    </div>
  );
}
