import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
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
import {
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Redo2,
  Rocket,
  Settings2,
  Smartphone,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { MinimalStorefront } from "@/storefront/MinimalStorefront";
import { BoldStorefront } from "@/storefront/BoldStorefront";
import { BoutiqueStorefront } from "@/storefront/BoutiqueStorefront";
import { useDraftHistory } from "@/storefront/builder/useDraftHistory";
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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
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
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-right">
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

export default function BuilderPage() {
  const [, setLocation] = useLocation();
  const managed = trpc.storefront.managed.useQuery();
  const activeStore = trpc.stores.active.useQuery(undefined, { retry: false });
  const saveDraft = trpc.storefront.saveDraft.useMutation();
  const publish = trpc.storefront.publish.useMutation();
  const uploadAsset = trpc.storefront.uploadAsset.useMutation();
  const utils = trpc.useUtils();

  const {
    config,
    update,
    undo,
    redo,
    reset,
    dirty,
    markSaved,
    canUndo,
    canRedo,
  } = useDraftHistory(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflict, setConflict] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [addType, setAddType] = useState<StorefrontSectionType>("hero");
  const initialized = useRef(false);

  const storeName = activeStore.data?.name ?? "المتجر";

  useEffect(() => {
    if (initialized.current || !managed.data) return;
    const draft = managed.data.draft;
    if (draft?.config) {
      reset(draft.config);
      setBaseVersion(draft.version ?? 0);
      setSelectedId(sortSections(draft.config.sections)[0]?.id ?? null);
      initialized.current = true;
    }
  }, [managed.data, reset]);

  const sections = useMemo(
    () => (config ? sortSections(config.sections) : []),
    [config]
  );
  const selected = sections.find(s => s.id === selectedId) ?? null;

  // Minimal's hero is intentionally text-only, so hide the image field there.
  const visibleFields = (type: StorefrontSectionType) =>
    [...SECTION_FIELDS[type], ...COMMON_STYLE_FIELDS].filter(
      f => !(f.type === "image" && config?.templateKey === "minimal")
    );

  const patchSection = (id: string, patch: Partial<StorefrontSection>) => {
    if (!config) return;
    update({
      ...config,
      sections: config.sections.map(s => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const reindex = (list: StorefrontSection[]) =>
    list.map((s, i) => ({ ...s, order: i }));

  const moveById = (fromId: string, toId: string) => {
    if (!config) return;
    const list = sortSections(config.sections);
    const from = list.findIndex(s => s.id === fromId);
    const to = list.findIndex(s => s.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    update({ ...config, sections: reindex(arrayMove(list, from, to)) });
  };

  const addSection = () => {
    if (!config) return;
    const id = `${addType}-${Date.now().toString(36)}`;
    const next: StorefrontSection = {
      id,
      type: addType,
      enabled: true,
      order: config.sections.length,
      settings: {},
    };
    update({ ...config, sections: reindex([...sortSections(config.sections), next]) });
    setSelectedId(id);
  };

  const duplicateSection = (id: string) => {
    if (!config) return;
    const list = sortSections(config.sections);
    const index = list.findIndex(s => s.id === id);
    if (index < 0) return;
    const clone: StorefrontSection = {
      ...list[index],
      id: `${list[index].type}-${Date.now().toString(36)}`,
    };
    list.splice(index + 1, 0, clone);
    update({ ...config, sections: reindex(list) });
    setSelectedId(clone.id);
  };

  const deleteSection = (id: string) => {
    if (!config) return;
    const list = sortSections(config.sections).filter(s => s.id !== id);
    update({ ...config, sections: reindex(list) });
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

  // Autosave (debounced) — pauses while a conflict is unresolved.
  useEffect(() => {
    if (!config || !dirty || conflict !== null) return;
    const handle = setTimeout(async () => {
      try {
        setSaving(true);
        const res = await saveDraft.mutateAsync({
          config,
          expectedVersion: baseVersion,
        });
        if (res.conflict) {
          setConflict(res.currentVersion ?? 0);
        } else {
          setBaseVersion(res.version ?? baseVersion);
          markSaved();
          setLastSavedAt(new Date());
        }
      } catch {
        // Silent: keep local changes; next debounce retries.
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [config, dirty, conflict, baseVersion, saveDraft, markSaved]);

  const reloadLatest = async () => {
    const fresh = await managed.refetch();
    const draft = fresh.data?.draft;
    if (draft?.config) {
      reset(draft.config);
      setBaseVersion(draft.version ?? 0);
      setSelectedId(sortSections(draft.config.sections)[0]?.id ?? null);
    }
    setConflict(null);
  };

  const forceSave = async () => {
    if (!config || conflict === null) return;
    const res = await saveDraft.mutateAsync({ config, expectedVersion: conflict });
    if (res.conflict) {
      toast.error("تعذّر الحفظ: تغيّرت المسودة مرة أخرى.");
      return;
    }
    setBaseVersion(res.version ?? conflict);
    markSaved();
    setLastSavedAt(new Date());
    setConflict(null);
    toast.success("تم فرض حفظ تعديلاتك.");
  };

  const doPublish = async () => {
    try {
      const res = await publish.mutateAsync({});
      toast.success(`تم النشر — الإصدار ${res.versionNumber}`);
      await utils.storefront.managed.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر النشر.");
    }
  };

  const canvas = config ? (
    <div
      className={`overflow-hidden rounded-[18px] border border-[#e7e9e8] bg-white shadow-[0_24px_60px_-40px_rgba(12,42,38,0.5)] ${
        device === "mobile" ? "mx-auto max-w-[390px]" : "w-full"
      }`}
    >
      {config.templateKey === "minimal" ? (
        <MinimalStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedId}
          onSelectSection={setSelectedId}
        />
      ) : config.templateKey === "bold" ? (
        <BoldStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedId}
          onSelectSection={setSelectedId}
        />
      ) : config.templateKey === "boutique" ? (
        <BoutiqueStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedId}
          onSelectSection={setSelectedId}
        />
      ) : (
        <ModernStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedId}
          onSelectSection={setSelectedId}
        />
      )}
    </div>
  ) : null;

  const hierarchy = (
    <>
      <div className="flex items-center justify-between border-b border-[#e7e9e8] px-3.5 py-3">
        <span className="text-[13.5px] font-black">الأقسام</span>
        <span className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[11px] font-bold text-[#0B5D57]">
          {sections.length}
        </span>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map(section => (
              <SortableRow
                key={section.id}
                section={section}
                active={section.id === selectedId}
                onSelect={() => setSelectedId(section.id)}
                onToggle={() => patchSection(section.id, { enabled: !section.enabled })}
                onDuplicate={() => duplicateSection(section.id)}
                onDelete={() => deleteSection(section.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
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
          <Plus className="ml-1 size-4" />
          إضافة
        </Button>
      </div>
    </>
  );

  const settings = selected ? (
    <>
      <div className="flex items-center justify-between border-b border-[#e7e9e8] px-3.5 py-3">
        <span className="text-[13.5px] font-black">إعدادات القسم</span>
        <span className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[11px] font-bold text-[#0B5D57]">
          {SECTION_LABELS[selected.type]}
        </span>
      </div>
      <div className="space-y-3 p-3.5">
        <div className="flex items-center justify-between rounded-xl bg-[#f7faf9] p-3">
          <span className="text-[12.5px] font-bold">القسم مفعّل</span>
          <button
            type="button"
            onClick={() => patchSection(selected.id, { enabled: !selected.enabled })}
            className={`h-6 w-11 rounded-full transition ${selected.enabled ? "bg-[#0F766E]" : "bg-[#cbd5d1]"}`}
            aria-label="تفعيل"
          >
            <span
              className={`block size-5 rounded-full bg-white transition ${selected.enabled ? "mr-0.5" : "mr-[22px]"}`}
            />
          </button>
        </div>
        {visibleFields(selected.type).length === 0 ? (
          <p className="text-[12px] text-[#576B66]">
            لا توجد إعدادات نصية لهذا القسم — يظهر تلقائيًا من بيانات المتجر.
          </p>
        ) : (
          visibleFields(selected.type).map(field => {
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
                          const dataUrl = await new Promise<string>(
                            (resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(String(reader.result));
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            }
                          );
                          try {
                            const out = await uploadAsset.mutateAsync({
                              fileName: file.name,
                              dataUrl,
                            });
                            patchSection(selected.id, {
                              settings: {
                                ...selected.settings,
                                [field.key]: out.url,
                              },
                            });
                            toast.success("تم رفع الصورة.");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "تعذّر رفع الصورة."
                            );
                          }
                        }}
                      />
                    </label>
                    {url ? (
                      <button
                        type="button"
                        onClick={() =>
                          patchSection(selected.id, {
                            settings: { ...selected.settings, [field.key]: "" },
                          })
                        }
                        className="text-xs font-bold text-[#b03a2e]"
                      >
                        إزالة
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={url}
                    placeholder="أو الصق رابط صورة (https://…)"
                    onChange={e =>
                      patchSection(selected.id, {
                        settings: { ...selected.settings, [field.key]: e.target.value },
                      })
                    }
                    className="mt-2 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[12.5px] outline-none focus:border-[#0F766E]"
                  />
                </div>
              );
            }
            if (field.type === "color") {
              const current = typeof value === "string" ? value : "";
              const swatch = /^#[0-9a-fA-F]{6}$/.test(current)
                ? current
                : "#ffffff";
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
                        patchSection(selected.id, {
                          settings: {
                            ...selected.settings,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-[#e7e9e8] bg-white p-1"
                    />
                    <input
                      type="text"
                      value={current}
                      placeholder="#FFFFFF أو oklch(...)"
                      onChange={e =>
                        patchSection(selected.id, {
                          settings: {
                            ...selected.settings,
                            [field.key]: e.target.value,
                          },
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
                      patchSection(selected.id, {
                        settings: {
                          ...selected.settings,
                          [field.key]: e.target.value,
                        },
                      })
                    }
                    className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold outline-none focus:border-[#0F766E]"
                  >
                    <option value="">افتراضي القالب</option>
                    {(field.options ?? []).map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
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
                      patchSection(selected.id, {
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
                      patchSection(selected.id, {
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
                        field.type === "number"
                          ? raw === ""
                            ? 0
                            : Number(raw)
                          : raw;
                      patchSection(selected.id, {
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
    </>
  ) : (
    <p className="p-4 text-[12.5px] text-[#576B66]">اختر قسمًا لتعديل إعداداته.</p>
  );

  if (managed.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea]">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  if (managed.isError || !config) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea] px-6 text-center">
        <div>
          <p className="text-[15px] font-black">
            لا توجد مسودة قالب. فعّل قالبًا أولًا من صفحة القوالب.
          </p>
          <Button onClick={() => setLocation("/templates")} className="mt-4">
            فتح القوالب
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#0C2A26]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e9e8] bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLocation("/templates")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#576B66]"
          >
            <ArrowRight className="size-4" /> رجوع
          </button>
          <span className="text-[14px] font-black">محرّر المتجر</span>
          <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
            قالب: {config.templateKey}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="grid size-9 place-items-center rounded-lg border border-[#e7e9e8] bg-white disabled:opacity-40"
            title="تراجع"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="grid size-9 place-items-center rounded-lg border border-[#e7e9e8] bg-white disabled:opacity-40"
            title="إعادة"
          >
            <Redo2 className="size-4" />
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#576B66]">
            <span
              className={`size-2 rounded-full ${dirty ? "bg-[#d97706]" : "bg-[#0F766E]"}`}
            />
            {saving ? "جارٍ الحفظ…" : dirty ? "تغييرات غير محفوظة" : "محفوظ"}
          </span>
          <span className="hidden text-[11.5px] text-[#8a938d] sm:inline">
            آخر حفظ: {lastSavedAt ? lastSavedAt.toLocaleTimeString("ar-DZ") : "—"}
          </span>
          <Button
            variant="outline"
            onClick={() => window.open("/store", "_blank")}
            className="h-9 rounded-lg px-3 text-xs font-extrabold"
          >
            معاينة
          </Button>
          <Button
            onClick={doPublish}
            disabled={publish.isPending || conflict !== null}
            className="h-9 rounded-lg px-3 text-xs font-extrabold"
          >
            <Rocket className="ml-1 size-4" /> نشر
          </Button>
          {managed.data?.published ? (
            <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
              منشور: v{managed.data.published.versionNumber}
            </span>
          ) : null}
        </div>
      </div>

      {/* Conflict banner */}
      {conflict !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FEF3E2] px-3.5 py-2.5 text-[12.5px] font-bold text-[#8A4B00]">
          <span>
            المسودة تغيّرت من مكان آخر (نسخة {conflict}). لن نكتب فوقها صامتين.
          </span>
          <div className="flex gap-2">
            <Button onClick={reloadLatest} variant="outline" className="h-8 rounded-lg text-xs">
              تحميل الأحدث
            </Button>
            <Button onClick={forceSave} className="h-8 rounded-lg text-xs">
              فرض حفظ تعديلاتي
            </Button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_320px]">
        <aside className="hidden border-inline-end border-[#e7e9e8] bg-white lg:block">
          {hierarchy}
        </aside>

        <main className="overflow-auto p-4">
          <div className="mb-3 flex justify-center">
            <div className="inline-flex rounded-xl border border-[#e7e9e8] bg-white p-1">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`grid place-items-center rounded-lg px-3 py-1.5 text-xs font-bold ${
                  device === "desktop" ? "bg-[#0C2A26] text-white" : "text-[#576B66]"
                }`}
              >
                <Monitor className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`grid place-items-center rounded-lg px-3 py-1.5 text-xs font-bold ${
                  device === "mobile" ? "bg-[#0C2A26] text-white" : "text-[#576B66]"
                }`}
              >
                <Smartphone className="size-4" />
              </button>
            </div>
          </div>
          {canvas}
        </main>

        <aside className="hidden border-inline-start border-[#e7e9e8] bg-white lg:block">
          {settings}
        </aside>
      </div>

      {/* Mobile drawers */}
      <div className="flex gap-2 border-t border-[#e7e9e8] bg-white p-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1 rounded-lg text-xs font-extrabold">
              الأقسام
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px] p-0">
            <SheetHeader>
              <SheetTitle>الأقسام</SheetTitle>
            </SheetHeader>
            {hierarchy}
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1 rounded-lg text-xs font-extrabold">
              <Settings2 className="ml-1 size-4" /> الإعدادات
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] p-0">
            <SheetHeader>
              <SheetTitle>إعدادات القسم</SheetTitle>
            </SheetHeader>
            {settings}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
