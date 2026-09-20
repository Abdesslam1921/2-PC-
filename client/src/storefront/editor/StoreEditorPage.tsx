import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Rocket, Undo2, Redo2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { MinimalStorefront } from "@/storefront/MinimalStorefront";
import { BoldStorefront } from "@/storefront/BoldStorefront";
import { BoutiqueStorefront } from "@/storefront/BoutiqueStorefront";
import { ContentPanel } from "@/storefront/editor/ContentPanel";
import { SectionSettingsDialog } from "@/storefront/editor/SectionSettingsDialog";
import { ThemePanel } from "@/storefront/editor/ThemePanel";
import { useStoreDraft } from "@/storefront/editor/useStoreDraft";
import { trpc } from "@/lib/trpc";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import { templateDefaultSection } from "@shared/storefront/storefrontConfig";
import { templateDefaultTokens } from "@/storefront/themeDefaults";

type Rgb = { r: number; g: number; b: number; a: number };

function parseRgb(value: string): Rgb | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map(part => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.some(part => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function toHex(value: string): string | null {
  const rgb = parseRgb(value);
  if (!rgb || rgb.a === 0) return null;
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

/** Walk up until an opaque background is found (sections are often transparent). */
function resolveBackground(el: HTMLElement | null): string | null {
  let node: HTMLElement | null = el;
  while (node) {
    const hex = toHex(getComputedStyle(node).backgroundColor);
    if (hex) return hex;
    node = node.parentElement;
  }
  return null;
}

export default function StoreEditorPage() {
  const [, setLocation] = useLocation();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const {
    managed,
    config,
    update,
    undo,
    redo,
    canUndo,
    canRedo,
    dirty,
    saving,
    conflict,
    setConflict,
    setBaseVersion,
    publish,
    reloadLatest,
  } = useStoreDraft();


  // Section selection is shared by BOTH panels: selecting a section scrolls the
  // live preview to it and draws a highlight, so the merchant always sees what
  // they are editing.
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  /** Section whose settings editor is open (docked on desktop, full-screen on mobile). */
  const [settingsSectionId, setSettingsSectionId] = useState<string | null>(null);
  /**
   * A field the merchant clicked inside the preview. The panel opens the
   * matching section and scrolls/focuses that exact control. `nonce` re-fires
   * the focus when the same field is clicked twice.
   */
  const [focusField, setFocusField] = useState<{
    sectionId: string;
    key: string;
    nonce: number;
  } | null>(null);

  const selectSection = useCallback((id: string) => {
    setSelectedSectionId(id);
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document
        .getElementById(`sf-sec-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  /**
   * Preview click: selects + highlights the section, opens its settings editor
   * and focuses the exact field that was clicked (text/image/background).
   */
  const selectFromPreview = useCallback(
    (id: string, fieldKey?: string | null) => {
      selectSection(id);
      // Theme tokens belong to the theme panel; section fields open the section
      // settings editor. Clicking unmapped content just opens that section.
      if (fieldKey && fieldKey.startsWith("--sf-")) {
        setSettingsSectionId(null);
        setFocusField({ sectionId: id, key: fieldKey, nonce: Date.now() });
        return;
      }
      setSettingsSectionId(id);
      if (fieldKey) {
        setFocusField({ sectionId: id, key: fieldKey, nonce: Date.now() });
      }
    },
    [selectSection]
  );

  useEffect(() => {
    if (!config) return;
    setSelectedSectionId(current => {
      if (current && config.sections.some(s => s.id === current)) return current;
      return (
        [...config.sections].sort((a, b) => a.order - b.order)[0]?.id ?? null
      );
    });
  }, [config]);

  const activeStore = trpc.stores.active.useQuery(undefined, { retry: false });
  const storeName = activeStore.data?.name || "المتجر";

  /**
   * Colors actually rendered by the selected section (e.g. Bold's dark hero),
   * so the theme pickers and the section fields open on the real value instead
   * of a static default.
   */
  const [liveColors, setLiveColors] = useState<Record<string, string>>({});
  const [liveFieldValues, setLiveFieldValues] = useState<
    Record<string, string | number | boolean>
  >({});
  useEffect(() => {
    if (!selectedSectionId) return;
    const node = document.getElementById(`sf-sec-${selectedSectionId}`);
    const root = (node?.firstElementChild ?? null) as HTMLElement | null;
    if (!root) return;
    const computed = getComputedStyle(root);
    const cssVar = (name: string) => computed.getPropertyValue(name).trim();
    const background = resolveBackground(root);
    const text = toHex(computed.color);

    // Effective values for EVERY editable field of this section, so each input
    // can show what is actually rendered before the merchant overrides it.
    setLiveFieldValues({
      styleBg: background ?? "",
      styleText: text ?? "",
      styleTextMuted: cssVar("--sf-color-text-muted"),
      styleBorderColor: cssVar("--sf-color-border"),
      styleGradientFrom: cssVar("--sf-color-primary"),
      styleGradientTo: cssVar("--sf-color-primary-hover"),
      color: cssVar("--sf-color-text"),
      text: storeName,
    });

    setLiveColors(prev => {
      const next: Record<string, string> = {};
      if (background) next["--sf-color-background"] = background;
      if (text) next["--sf-color-text"] = text;
      if (
        prev["--sf-color-background"] === next["--sf-color-background"] &&
        prev["--sf-color-text"] === next["--sf-color-text"]
      ) {
        return prev;
      }
      return next;
    });
  }, [config, selectedSectionId, storeName]);

  const previewStyle = useMemo(() => {
    if (!config) return {} as CSSProperties;
    return {
      ...templateDefaultTokens(config.templateKey),
      ...buildStorefrontTokenOverrides(config.theme ?? {}),
      fontFamily: "var(--sf-font-heading, revert-layer)",
    } as CSSProperties;
  }, [config]);

  if (managed.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea]">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }
  if (!config) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea] px-6 text-center">
        <div>
          <p className="text-[15px] font-black">
            لا توجد مسودة قالب بعد. اختر قالبًا وفعّله أولًا.
          </p>
          <Button className="mt-4" onClick={() => setLocation("/templates")}>
            فتح القوالب
          </Button>
        </div>
      </div>
    );
  }

  const preview = (
    <div data-sf-root style={previewStyle}>
      {config.templateKey === "minimal" ? (
        <MinimalStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedSectionId}
          onSelectSection={selectFromPreview}
        />
      ) : config.templateKey === "bold" ? (
        <BoldStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedSectionId}
          onSelectSection={selectFromPreview}
        />
      ) : config.templateKey === "boutique" ? (
        <BoutiqueStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedSectionId}
          onSelectSection={selectFromPreview}
        />
      ) : (
        <ModernStorefront
          config={config}
          storeName={storeName}
          highlightSectionId={selectedSectionId}
          onSelectSection={selectFromPreview}
        />
      )}
    </div>
  );

  /**
   * One page, one panel: content sections (structure + content) followed by the
   * theme tokens. No setting appears twice — background/text/font/spacing live
   * ONLY in the theme, and each section keeps only its own content fields.
   */
  const panel = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ContentPanel
        config={config}
        onChange={update}
        selectedSectionId={selectedSectionId}
        onSelectSection={selectSection}
        onEditSection={setSettingsSectionId}
      />
      <div className="h-3 bg-[#f4f1ea]" />
      <ThemePanel
        config={config}
        onChange={update}
        liveColors={liveColors}
        focusToken={
          focusField && focusField.key.startsWith("--sf-")
            ? { key: focusField.key, nonce: focusField.nonce }
            : null
        }
      />
    </div>
  );

  /** Reset everything the editor owns back to the template's defaults. */
  const resetAll = () =>
    update({
      ...config,
      theme: {},
      sections: config.sections.map(s => {
        const fallback = templateDefaultSection(config.templateKey, s);
        return {
          ...s,
          settings: { ...(fallback?.settings ?? {}) },
          items: fallback?.items ? [...fallback.items] : undefined,
        };
      }),
    });

  return (
    <div dir="rtl" className="flex h-screen flex-col bg-[#f4f1ea] text-[#0C2A26]">
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
          <span className="text-[14px] font-black">الثيم</span>
          <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
            القالب: {config.templateKey}
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
          <button
            type="button"
            onClick={resetAll}
            title="إعادة تعيين كل شيء (المحتوى + الثيم) لافتراضي القالب"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e7e9e8] bg-white px-3 text-[11.5px] font-extrabold text-[#0B5D57] hover:border-[#0F766E]"
          >
            <RotateCcw className="size-4" />
            إعادة تعيين الكل
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#576B66]">
            <span className={`size-2 rounded-full ${dirty ? "bg-[#d97706]" : "bg-[#0F766E]"}`} />
            {saving ? "جارٍ الحفظ…" : dirty ? "غير محفوظ" : "محفوظ"}
          </span>
          <Button
            onClick={publish}
            className="h-9 gap-1.5 rounded-lg px-3 text-xs font-extrabold"
          >
            <Rocket className="size-4" /> نشر
          </Button>
          {managed.data?.published ? (
            <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
              منشور: v{managed.data.published.versionNumber}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body: side panel (RTL start/right) + preview + docked section editor.
          The settings column only exists on desktop (≥xl); from lg to xl the
          panel steps aside while it is open, so the preview is never covered. */}
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          settingsSectionId
            ? "lg:grid-cols-[1fr_380px] xl:grid-cols-[360px_1fr_380px]"
            : "lg:grid-cols-[360px_1fr]"
        }`}
      >
        <aside
          className={`hidden min-h-0 flex-col overflow-hidden border-inline-start border-[#e7e9e8] bg-white lg:flex ${
            settingsSectionId ? "lg:hidden xl:flex" : ""
          }`}
        >
          {panel}
        </aside>

        <main className="min-h-0 overflow-auto p-4">
          <p className="mb-3 text-center text-[11.5px] font-bold text-[#576B66]">
            معاينة حيّة (المسودة) — اضغط على أي عنصر لتعديله
          </p>
          <div className="mx-auto max-w-[900px] overflow-hidden rounded-[18px] border border-[#e7e9e8] shadow-[0_24px_60px_-40px_rgba(12,42,38,0.5)]">
            {preview}
          </div>
        </main>

        {settingsSectionId ? (
          <SectionSettingsDialog
            config={config}
            onChange={update}
            sectionId={settingsSectionId}
            focusField={focusField}
            liveValues={liveFieldValues}
            onClose={() => setSettingsSectionId(null)}
          />
        ) : null}
      </div>

      {/* Mobile: one panel (content + theme) in a sheet */}
      <div className="flex gap-2 border-t border-[#e7e9e8] bg-white p-3 lg:hidden">
        <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
          <button
            type="button"
            onClick={() => setMobilePanelOpen(true)}
            className="flex-1 rounded-lg border border-[#0F766E] bg-[#e4f3ef] px-3 py-2 text-xs font-extrabold text-[#0B5D57]"
          >
            الثيم
          </button>
          <SheetContent side="right" className="w-[340px] p-0">
            <SheetHeader>
              <SheetTitle>الثيم</SheetTitle>
            </SheetHeader>
            <div className="flex h-full min-h-0 flex-col">{panel}</div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
