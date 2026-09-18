import { useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Rocket, Undo2, Redo2 } from "lucide-react";
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
import { ThemePanel } from "@/storefront/editor/ThemePanel";
import { useStoreDraft } from "@/storefront/editor/useStoreDraft";
import { trpc } from "@/lib/trpc";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import { templateDefaultTokens } from "@/storefront/themeDefaults";

type Tab = "content" | "theme";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "content", label: "المحتوى" },
  { id: "theme", label: "الثيم" },
];

export default function StoreEditorPage() {
  const [location, setLocation] = useLocation();
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

  // Tab state is local (instant, no navigation). The initial tab is read once
  // from the URL so the legacy redirects land on the intended tab.
  const [tab, setTabState] = useState<Tab>(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    return new URLSearchParams(search).get("tab") === "theme"
      ? "theme"
      : "content";
  });
  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      window.history.replaceState(null, "", `/store/editor?tab=${next}`);
    } catch {
      /* ignore */
    }
  };

  /** Resolve a conflict by adopting the server version (next save overwrites). */
  const forceSave = () => {
    if (conflict === null) return;
    setBaseVersion(conflict);
    setConflict(null);
  };

  const previewStyle = useMemo(() => {
    if (!config) return {} as CSSProperties;
    return {
      ...templateDefaultTokens(config.templateKey),
      ...buildStorefrontTokenOverrides(config.theme ?? {}),
      fontFamily: "var(--sf-font-heading, revert-layer)",
    } as CSSProperties;
  }, [config]);

  const activeStore = trpc.stores.active.useQuery(undefined, { retry: false });
  const storeName = activeStore.data?.name || "المتجر";

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
    <div data-sf-root style={previewStyle} className="pointer-events-none">
      {config.templateKey === "minimal" ? (
        <MinimalStorefront config={config} storeName={storeName} />
      ) : config.templateKey === "bold" ? (
        <BoldStorefront config={config} storeName={storeName} />
      ) : config.templateKey === "boutique" ? (
        <BoutiqueStorefront config={config} storeName={storeName} />
      ) : (
        <ModernStorefront config={config} storeName={storeName} />
      )}
    </div>
  );

  const panel =
    tab === "theme" ? (
      <ThemePanel config={config} onChange={update} />
    ) : (
      <ContentPanel config={config} onChange={update} />
    );

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
          <span className="text-[14px] font-black">محرّر المتجر</span>
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
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#576B66]">
            <span className={`size-2 rounded-full ${dirty ? "bg-[#d97706]" : "bg-[#0F766E]"}`} />
            {saving ? "جارٍ الحفظ…" : dirty ? "غير محفوظ" : "محفوظ"}
          </span>
          <Button
            onClick={publish}
            disabled={conflict !== null}
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

      {/* Tabs */}
      <div className="flex justify-center gap-1.5 border-b border-[#e7e9e8] bg-white px-3.5 pb-2.5">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-6 py-2 text-[13px] font-black ${
              tab === t.id
                ? "border-[#0F766E] bg-[#e4f3ef] text-[#0B5D57]"
                : "border-[#e7e9e8] bg-white text-[#4A5A56]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {conflict !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FEF3E2] px-3.5 py-2.5 text-[12.5px] font-bold text-[#8A4B00]">
          <span>المسودة تغيّرت من مكان آخر (نسخة {conflict}).</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={reloadLatest}
              className="h-8 rounded-lg text-xs font-extrabold"
            >
              تحميل الأحدث
            </Button>
            <Button onClick={forceSave} className="h-8 rounded-lg text-xs font-extrabold">
              فرض حفظ تعديلاتي
            </Button>
          </div>
        </div>
      ) : null}

      {/* Body: side panel (RTL start/right) + fixed preview (center) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="hidden min-h-0 flex-col overflow-hidden border-inline-start border-[#e7e9e8] bg-white lg:flex">
          {panel}
        </aside>

        <main className="min-h-0 overflow-auto p-4">
          <p className="mb-3 text-center text-[11.5px] font-bold text-[#576B66]">
            معاينة حيّة (المسودة)
          </p>
          <div className="mx-auto max-w-[900px] overflow-hidden rounded-[18px] border border-[#e7e9e8] shadow-[0_24px_60px_-40px_rgba(12,42,38,0.5)]">
            {preview}
          </div>
        </main>
      </div>

      {/* Mobile: same tabs, panel in a sheet */}
      <div className="flex gap-2 border-t border-[#e7e9e8] bg-white p-3 lg:hidden">
        {TABS.map(t => (
          <Sheet
            key={t.id}
            open={mobilePanelOpen && tab === t.id}
            onOpenChange={open => {
              if (open) {
                setTab(t.id);
                setMobilePanelOpen(true);
              } else {
                setMobilePanelOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab(t.id);
                setMobilePanelOpen(true);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-extrabold ${
                tab === t.id ? "border-[#0F766E] bg-[#e4f3ef] text-[#0B5D57]" : "border-[#e7e9e8] text-[#576B66]"
              }`}
            >
              {t.label}
            </button>
            <SheetContent side="right" className="w-[340px] p-0">
              <SheetHeader>
                <SheetTitle>{t.label}</SheetTitle>
              </SheetHeader>
              {t.id === "theme" ? (
                <ThemePanel config={config} onChange={update} />
              ) : (
                <ContentPanel config={config} onChange={update} />
              )}
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </div>
  );
}
