import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ADDABLE_SECTION_TYPES,
  COMMON_STYLE_FIELDS,
  SECTION_FIELDS,
  SECTION_LABELS,
} from "@shared/storefront/sectionFields";
import type {
  StorefrontConfig,
  StorefrontSection,
  StorefrontSectionType,
} from "@shared/storefront/storefrontConfig";

const sortSections = (sections: StorefrontSection[]) =>
  [...sections].sort((a, b) => a.order - b.order);
const reindex = (list: StorefrontSection[]) =>
  list.map((s, i) => ({ ...s, order: i }));

function SortableRow({
  section,
  active,
  onSelect,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  section: StorefrontSection;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`flex items-center gap-2 border-b border-[#f1f3f2] px-3 py-2.5 text-[13px] font-bold ${
        active ? "bg-[#e4f3ef] text-[#0B5D57]" : "text-[#2f433f]"
      }`}
    >
      <button
        type="button"
        className="touch-none text-[#9fb0ac]"
        aria-label="سحب لإعادة الترتيب"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 whitespace-normal py-0.5 text-right leading-6"
      >
        {SECTION_LABELS[section.type]}
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          title={section.enabled ? "إخفاء" : "إظهار"}
          className="grid size-7 place-items-center rounded-md text-[#7b8a86] hover:bg-white"
        >
          {section.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="تكرار"
          className="grid size-7 place-items-center rounded-md text-[#7b8a86] hover:bg-white"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="حذف"
          className="grid size-7 place-items-center rounded-md text-[#b03a2e] hover:bg-white"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ContentPanel({
  config,
  onChange,
}: {
  config: StorefrontConfig;
  onChange: (next: StorefrontConfig) => void;
}) {
  const uploadAsset = trpc.storefront.uploadAsset.useMutation();
  const sections = useMemo(() => sortSections(config.sections), [config.sections]);
  const [selectedId, setSelectedId] = useState<string | null>(
    sections[0]?.id ?? null
  );
  const [addType, setAddType] = useState<StorefrontSectionType>("hero");

  const selected = sections.find(s => s.id === selectedId) ?? null;

  const patch = (id: string, p: Partial<StorefrontSection>) =>
    onChange({
      ...config,
      sections: config.sections.map(s => (s.id === id ? { ...s, ...p } : s)),
    });

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
    setSelectedId(id);
  };

  const duplicateSection = (id: string) => {
    const list = sortSections(config.sections);
    const index = list.findIndex(s => s.id === id);
    if (index < 0) return;
    const clone: StorefrontSection = {
      ...list[index],
      id: `${list[index].type}-${Date.now().toString(36)}`,
    };
    list.splice(index + 1, 0, clone);
    onChange({ ...config, sections: reindex(list) });
    setSelectedId(clone.id);
  };

  const deleteSection = (id: string) => {
    const list = sortSections(config.sections).filter(s => s.id !== id);
    onChange({ ...config, sections: reindex(list) });
    if (selectedId === id) setSelectedId(list[0]?.id ?? null);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) moveById(String(active.id), String(over.id));
  };

  const fields = selected
    ? [...SECTION_FIELDS[selected.type], ...COMMON_STYLE_FIELDS].filter(
        f =>
          !(
            f.key === "imageUrl" &&
            config.templateKey === "minimal"
          )
      )
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#e7e9e8] px-3.5 py-3">
        <span className="text-[13.5px] font-black">الأقسام</span>
        <span className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[11px] font-bold text-[#0B5D57]">
          {sections.length}
        </span>
      </div>

      <div className="flex-none">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map(section => (
              <SortableRow
                key={section.id}
                section={section}
                active={section.id === selectedId}
                onSelect={() => setSelectedId(section.id)}
                onToggle={() => patch(section.id, { enabled: !section.enabled })}
                onDuplicate={() => duplicateSection(section.id)}
                onDelete={() => deleteSection(section.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex items-center gap-2 border-t border-[#e7e9e8] p-3">
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

      <div className="border-t border-[#e7e9e8]">
        <div className="flex items-center justify-between border-b border-[#e7e9e8] px-3.5 py-3">
          <span className="text-[13.5px] font-black">إعدادات القسم</span>
          {selected ? (
            <span className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[11px] font-bold text-[#0B5D57]">
              {SECTION_LABELS[selected.type]}
            </span>
          ) : null}
        </div>
        {!selected ? (
          <p className="p-4 text-[12.5px] text-[#576B66]">اختر قسمًا لتعديل إعداداته.</p>
        ) : (
          <div className="space-y-3 p-3.5">
            <div className="flex items-center justify-between rounded-xl bg-[#f7faf9] p-3">
              <span className="text-[12.5px] font-bold">القسم مفعّل</span>
              <button
                type="button"
                onClick={() => patch(selected.id, { enabled: !selected.enabled })}
                className={`h-6 w-11 rounded-full transition ${
                  selected.enabled ? "bg-[#0F766E]" : "bg-[#cbd5d1]"
                }`}
                aria-label="تفعيل"
              >
                <span
                  className={`block size-5 rounded-full bg-white transition ${
                    selected.enabled ? "mr-0.5" : "mr-[22px]"
                  }`}
                />
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-[12px] text-[#576B66]">
                لا توجد إعدادات لهذا القسم — يظهر تلقائيًا من بيانات المتجر.
              </p>
            ) : (
              fields.map(field => {
                const value = selected.settings[field.key];
                if (field.type === "image") {
                  const url = typeof value === "string" ? value : "";
                  return (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-3">
                        <span
                          className="size-14 shrink-0 rounded-lg border border-[#e7e9e8] bg-[#f3f7f6] bg-cover bg-center"
                          style={url ? { backgroundImage: `url(${url})` } : undefined}
                        />
                        <label className="cursor-pointer rounded-lg border border-[#e7e9e8] px-3 py-2 text-xs font-bold hover:border-[#0F766E]">
                          {uploadAsset.isPending ? "جارٍ الرفع…" : "تغيير الصورة"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async event => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error("حجم الصورة يتجاوز 5MB.");
                                return;
                              }
                              const dataUrl = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(String(reader.result));
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                              });
                              try {
                                const out = await uploadAsset.mutateAsync({
                                  fileName: file.name,
                                  dataUrl,
                                });
                                patch(selected.id, {
                                  settings: { ...selected.settings, [field.key]: out.url },
                                });
                                toast.success("تم رفع الصورة.");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "تعذّر رفع الصورة."
                                );
                              }
                            }}
                          />
                        </label>
                        {url ? (
                          <button
                            type="button"
                            onClick={() =>
                              patch(selected.id, {
                                settings: { ...selected.settings, [field.key]: "" },
                              })
                            }
                            className="text-xs font-bold text-[#b03a2e]"
                          >
                            إزالة
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                if (field.type === "color") {
                  const current = typeof value === "string" ? value : "";
                  const swatch = /^#[0-9a-fA-F]{6}$/.test(current) ? current : "#ffffff";
                  return (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={swatch}
                          onChange={e =>
                            patch(selected.id, {
                              settings: { ...selected.settings, [field.key]: e.target.value },
                            })
                          }
                          className="h-10 w-12 cursor-pointer rounded-lg border border-[#e7e9e8] bg-white p-1"
                        />
                        <input
                          type="text"
                          value={current}
                          onChange={e =>
                            patch(selected.id, {
                              settings: { ...selected.settings, [field.key]: e.target.value },
                            })
                          }
                          className="flex-1 rounded-[10px] border border-[#e7e9e8] p-2.5 text-[12.5px] outline-none focus:border-[#0F766E]"
                        />
                      </div>
                    </div>
                  );
                }
                if (field.type === "select") {
                  const current = typeof value === "string" ? value : "";
                  return (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <select
                        value={current}
                        onChange={e =>
                          patch(selected.id, {
                            settings: { ...selected.settings, [field.key]: e.target.value },
                          })
                        }
                        className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold"
                      >
                        <option value="">افتراضي القالب</option>
                        {(field.options ?? []).map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (field.type === "boolean") {
                  return (
                    <label
                      key={field.key}
                      className="flex items-center justify-between rounded-xl border border-[#e7e9e8] p-3 text-[12.5px] font-bold"
                    >
                      {field.label}
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={e =>
                          patch(selected.id, {
                            settings: { ...selected.settings, [field.key]: e.target.checked },
                          })
                        }
                        className="size-4 accent-[#0F766E]"
                      />
                    </label>
                  );
                }
                return (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                      {field.label}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={String(value ?? "")}
                        onChange={e =>
                          patch(selected.id, {
                            settings: { ...selected.settings, [field.key]: e.target.value },
                          })
                        }
                        className="w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={String(value ?? "")}
                        onChange={e => {
                          const raw = e.target.value;
                          const next =
                            field.type === "number" ? (raw === "" ? 0 : Number(raw)) : raw;
                          patch(selected.id, {
                            settings: { ...selected.settings, [field.key]: next },
                          });
                        }}
                        className="w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
