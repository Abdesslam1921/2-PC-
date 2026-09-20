import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ColorField } from "@/storefront/editor/ColorField";
import {
  COMMON_STYLE_FIELDS,
  COMMON_STYLE_GROUPS,
  SECTION_FIELDS,
  SECTION_ITEM_FIELDS,
  SECTION_ITEM_LABELS,
  SECTION_LABELS,
  visibleSectionFields,
  type SectionField,
} from "@shared/storefront/sectionFields";
import { templateDefaultSection } from "@shared/storefront/storefrontConfig";
import type {
  StorefrontConfig,
  StorefrontSection,
  StorefrontSectionItem,
} from "@shared/storefront/storefrontConfig";

const newItemId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

/** Upload an image file through the existing asset pipeline. */
function useImageUpload() {
  const uploadAsset = trpc.storefront.uploadAsset.useMutation();
  return async (file: File): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يتجاوز 5MB.");
      return null;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const out = await uploadAsset.mutateAsync({ fileName: file.name, dataUrl });
      return out.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر رفع الصورة.");
      return null;
    }
  };
}

function FieldControl({
  field,
  value,
  onChange,
  onClear,
  upload,
  compact,
  effective,
  effectiveLabel,
}: {
  field: SectionField;
  value: unknown;
  onChange: (next: unknown) => void;
  /** Removes the override so the field follows the theme/template default. */
  onClear: () => void;
  upload: (file: File) => Promise<string | null>;
  compact?: boolean;
  /** Value actually rendered when this setting is empty. */
  effective?: string | number | boolean;
  /** Friendly label of the effective value (selects). */
  effectiveLabel?: string;
}) {
  const inputClass = compact
    ? "h-9 w-full rounded-lg border border-[#e7e9e8] px-2 text-[12.5px] outline-none focus:border-[#0F766E]"
    : "w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]";
  const hasEffective =
    effective !== undefined && effective !== null && String(effective) !== "";
  const placeholder = hasEffective ? `افتراضي: ${effective}` : undefined;

  if (field.type === "color") {
    const chosen = typeof value === "string" ? value : "";
    return (
      <ColorField
        value={chosen}
        onChange={onChange}
        defaultValue={hasEffective ? String(effective) : undefined}
        compact={compact}
        ariaLabel={field.label}
      />
    );
  }

  if (field.type === "image") {
    const url = typeof value === "string" ? value : "";
    return (
      <div className="flex items-center gap-3">
        <span
          className="size-14 shrink-0 rounded-lg border border-[#e7e9e8] bg-[#f3f7f6] bg-cover bg-center"
          style={url ? { backgroundImage: `url(${url})` } : undefined}
        />
        <label className="cursor-pointer rounded-lg border border-[#e7e9e8] px-3 py-2 text-xs font-bold hover:border-[#0F766E]">
          تغيير الصورة
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const next = await upload(file);
              if (next) onChange(next);
            }}
          />
        </label>
        {url ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold text-[#b03a2e]"
          >
            إزالة
          </button>
        ) : null}
      </div>
    );
  }

  if (field.type === "select") {
    const current = typeof value === "string" ? value : "";
    const label =
      effectiveLabel ??
      field.options?.find(option => option.value === String(effective ?? ""))?.label ??
      (hasEffective ? String(effective) : "");
    return (
      <select
        value={current}
        onChange={e => {
          const next = e.target.value;
          if (next === "") onClear();
          else onChange(next);
        }}
        className={`${inputClass} bg-white font-bold`}
      >
        <option value="">
          {label ? `افتراضي القالب (${label})` : "افتراضي القالب"}
        </option>
        {(field.options ?? [])
          .filter(option => option.value !== "")
          .map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    const stored = typeof value === "boolean";
    const effectiveText = effective === undefined ? null : effective ? "مفعّل" : "معطّل";
    return (
      <span className="flex items-center gap-2">
        {stored ? (
          <button
            type="button"
            onClick={onClear}
            title="رجوع للافتراضي"
            className="rounded-md px-2 py-1 text-[11px] font-bold text-[#0B5D57] hover:bg-[#f7faf9]"
          >
            افتراضي
          </button>
        ) : null}
        {effectiveText ? (
          <span className="text-[10.5px] font-bold text-[#9fb0ac]">
            افتراضي: {effectiveText}
          </span>
        ) : null}
        <input
          type="checkbox"
          checked={stored ? Boolean(value) : Boolean(effective)}
          onChange={e => onChange(e.target.checked)}
          className="size-4 accent-[#0F766E]"
        />
      </span>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        rows={3}
        value={String(value ?? "")}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={String(value ?? "")}
      placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value;
        if (field.type === "number") {
          // Clearing returns the field to the effective default instead of 0.
          if (raw === "") onClear();
          else onChange(Number(raw));
          return;
        }
        onChange(raw);
      }}
      className={inputClass}
    />
  );
}

/**
 * Section settings editor.
 *
 * Desktop: docked as a third column so the live preview stays fully visible and
 * updates while it is open. Mobile: full-screen. Header/footer are fixed and the
 * middle scrolls; there is no explicit save (the draft autosaves).
 */
export function SectionSettingsDialog({
  config,
  onChange,
  sectionId,
  focusField,
  liveValues,
  onClose,
}: {
  config: StorefrontConfig;
  onChange: (next: StorefrontConfig) => void;
  sectionId: string | null;
  focusField?: { sectionId: string; key: string; nonce: number } | null;
  /** Live rendered values for this section (colors resolved from the preview). */
  liveValues?: Record<string, string | number | boolean>;
  onClose: () => void;
}) {
  const upload = useImageUpload();
  const bodyRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const section = config.sections.find(s => s.id === sectionId) ?? null;

  const patch = (p: Partial<StorefrontSection>) => {
    if (!section) return;
    onChange({
      ...config,
      sections: config.sections.map(s => (s.id === section.id ? { ...s, ...p } : s)),
    });
  };
  const setSetting = (key: string, value: unknown) =>
    patch({ settings: { ...section?.settings, [key]: value as never } });

  /**
   * Remove an override so the field follows the theme/template again. Dependent
   * keys (e.g. the stored background color) go with it, otherwise switching
   * "نوع الخلفية" back to the default would keep the old value painted.
   */
  const clearSetting = (key: string, also: string[] = []) => {
    if (!section) return;
    const next = { ...section.settings };
    delete next[key];
    for (const extra of also) delete next[extra];
    patch({ settings: next });
  };

  /** Values actually rendered by this section (theme + template + live DOM). */
  const templateDefaults = useMemo(
    () =>
      (section ? templateDefaultSection(config.templateKey, section)?.settings : null) ??
      {},
    [config.templateKey, section]
  );
  const effectiveValue = (key: string): string | number | boolean | undefined => {
    const live = liveValues?.[key];
    if (live !== undefined && live !== "") return live;
    return templateDefaults[key];
  };

  const resetSection = () => {
    if (!section) return;
    const fallback = templateDefaultSection(config.templateKey, section);
    patch({
      settings: { ...(fallback?.settings ?? {}) },
      items: fallback?.items ? [...fallback.items] : undefined,
    });
  };

  /** Preview click → open that exact control inside the dialog. */
  useEffect(() => {
    if (!focusField || !sectionId) return;
    const key = focusField.key;
    const el =
      fieldRefs.current[key] ??
      (key === "imageUrl" ? fieldRefs.current["styleImage"] : null) ??
      (key === "--sf-color-background" ? fieldRefs.current["styleBg"] : null);
    if (!el) return;
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.querySelector<HTMLElement>(
      "input:not([type=file]), textarea, select"
    )?.focus({ preventScroll: true });
    setFlashKey(key);
    const timer = setTimeout(() => setFlashKey(null), 1600);
    return () => clearTimeout(timer);
  }, [focusField, sectionId, config.templateKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Content fields = the section's own fields; style groups = the common
   * overrides. Both go through `visibleSectionFields`, so a field that is not
   * relevant (gradient stops while the background is solid, the common font on
   * the signature which has its own) never shows.
   */
  const contentFields = section
    ? visibleSectionFields(
        section.type,
        SECTION_FIELDS[section.type],
        section.settings
      ).filter(f => !(f.key === "imageUrl" && config.templateKey === "minimal"))
    : [];
  const styleFieldByKey = useMemo(
    () => new Map(COMMON_STYLE_FIELDS.map(field => [field.key, field])),
    []
  );
  const styleGroups = COMMON_STYLE_GROUPS.map(group => ({
    label: group.label,
    fields: section
      ? visibleSectionFields(
          section.type,
          group.keys
            .map(key => styleFieldByKey.get(key))
            .filter((field): field is SectionField => Boolean(field)),
          section.settings
        )
      : [],
  })).filter(group => group.fields.length > 0);

  const items = section?.items ?? [];
  const itemFields = section ? SECTION_ITEM_FIELDS[section.type] ?? [] : [];
  const setItems = (next: StorefrontSectionItem[] | undefined) => patch({ items: next });

  const renderField = (field: SectionField) => {
    if (!section) return null;
    const control = (
      <FieldControl
        field={field}
        value={section.settings[field.key]}
        onChange={next => setSetting(field.key, next)}
        onClear={() => clearSetting(field.key, field.onClearAlso)}
        upload={upload}
        effective={effectiveValue(field.key)}
      />
    );
    return (
      <div
        key={field.key}
        ref={el => {
          fieldRefs.current[field.key] = el;
        }}
        className={`rounded-xl transition ${
          flashKey === field.key ? "bg-[#f0faf8] p-2 -m-2 ring-2 ring-[#0F766E]/50" : ""
        }`}
      >
        {field.type === "boolean" ? (
          <label className="flex items-center justify-between rounded-xl border border-[#e7e9e8] p-3 text-[12.5px] font-bold">
            {field.label}
            {control}
          </label>
        ) : (
          <>
            <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
              {field.label}
            </label>
            {control}
          </>
        )}
      </div>
    );
  };

  if (!section) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`إعدادات القسم: ${SECTION_LABELS[section.type]}`}
      className="fixed inset-0 z-[60] flex min-h-0 flex-col bg-white lg:static lg:z-auto lg:h-full lg:border-inline-start lg:border-[#e7e9e8]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#e7e9e8] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-black">إعدادات القسم</span>
          <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
            {SECTION_LABELS[section.type]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetSection}
            title="إعادة تعيين القسم إلى الافتراضي"
            className="grid size-8 place-items-center rounded-lg text-[#0F766E] hover:bg-[#f7faf9]"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            aria-label="إغلاق"
            className="grid size-8 place-items-center rounded-lg border border-[#e7e9e8] hover:bg-[#f7faf9]"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <label className="flex items-center justify-between rounded-xl bg-[#f7faf9] p-3 text-[12.5px] font-bold">
          القسم مفعّل
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={e => patch({ enabled: e.target.checked })}
            className="size-4 accent-[#0F766E]"
          />
        </label>

        {itemFields.length ? (
          <div className="rounded-xl border border-[#e7e9e8] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-black">
                {SECTION_ITEM_LABELS[section.type] ?? "العناصر"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems([...items, { id: newItemId("item"), name: "عنصر جديد" }])
                }
                className="rounded-md px-2 py-1 text-[11px] font-extrabold text-[#0B5D57] hover:bg-[#f7faf9]"
              >
                + إضافة عنصر
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-[11.5px] leading-6 text-[#576B66]">
                لا عناصر مخصّصة — تُعرض العناصر الافتراضية للقالب.
              </p>
            ) : null}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="space-y-2 rounded-xl border border-[#e7e9e8] bg-[#fbfcfc] p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#576B66]">
                      عنصر {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems(
                          items.filter(i => i.id !== item.id).length
                            ? items.filter(i => i.id !== item.id)
                            : undefined
                        )
                      }
                      className="text-[11px] font-bold text-[#b03a2e]"
                    >
                      حذف
                    </button>
                  </div>
                  {itemFields.map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-[11px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <FieldControl
                        field={field}
                        compact
                        value={(item as unknown as Record<string, unknown>)[field.key]}
                        onChange={next => {
                          setItems(
                            items.map(i =>
                              i.id === item.id ? { ...i, [field.key]: next } : i
                            )
                          );
                        }}
                        onClear={() => {
                          setItems(
                            items.map(i => {
                              if (i.id !== item.id) return i;
                              const copy = { ...i } as Record<string, unknown>;
                              delete copy[field.key];
                              return copy as unknown as StorefrontSectionItem;
                            })
                          );
                        }}
                        upload={upload}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {contentFields.length === 0 ? (
          <p className="text-[12px] text-[#576B66]">
            لا توجد إعدادات محتوى لهذا القسم — يظهر تلقائيًا من بيانات المتجر.
          </p>
        ) : (
          contentFields.map(renderField)
        )}

        {styleGroups.map(group => (
          <div key={group.label} className="space-y-3 pt-1">
            <div className="border-t border-[#e7e9e8] pt-3 text-[12px] font-black text-[#0C2A26]">
              {group.label}
            </div>
            {group.fields.map(renderField)}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#e7e9e8] px-4 py-3">
        <span className="text-[11px] font-bold text-[#576B66]">
          الحفظ تلقائي (مسودة) — «نشر» باش يبان فالمتجر.
        </span>
        <Button onClick={onClose} className="h-9 rounded-lg px-4 text-xs font-extrabold">
          تم
        </Button>
      </div>
    </section>
  );
}
