import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowRight, Loader2, Rocket, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { MinimalStorefront } from "@/storefront/MinimalStorefront";
import { BoldStorefront } from "@/storefront/BoldStorefront";
import { BoutiqueStorefront } from "@/storefront/BoutiqueStorefront";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import { validateStorefrontThemeConfig } from "@shared/storefront/themeSchema";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

type Category = "colors" | "typography" | "radius" | "spacing" | "layout" | "borders" | "effects";

const CATEGORIES: Array<{ id: Category; label: string; icon: string }> = [
  { id: "colors", label: "الألوان", icon: "◐" },
  { id: "typography", label: "الطباعة", icon: "Aa" },
  { id: "radius", label: "الحواف", icon: "◜" },
  { id: "spacing", label: "المسافات", icon: "↔" },
  { id: "layout", label: "التخطيط", icon: "▭" },
  { id: "borders", label: "الحدود", icon: "▤" },
  { id: "effects", label: "الظلال والتأثيرات", icon: "✷" },
];

const COLOR_FIELDS: Array<{ token: string; label: string }> = [
  { token: "--sf-color-primary", label: "اللون الأساسي" },
  { token: "--sf-color-primary-hover", label: "الأساسي (عند المرور)" },
  { token: "--sf-color-background", label: "الخلفية" },
  { token: "--sf-color-surface", label: "السطح" },
  { token: "--sf-color-text", label: "النص" },
  { token: "--sf-color-text-muted", label: "النص الباهت" },
  { token: "--sf-color-accent", label: "التمييز" },
];
const FONT_OPTIONS = ["Cairo", "Tajawal", "Rubik"];

const HEX = /^#[0-9a-fA-F]{6}$/;
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminance = (hex: string) => {
  const h = hex.replace("#", "");
  return (
    0.2126 * lin(parseInt(h.slice(0, 2), 16)) +
    0.7152 * lin(parseInt(h.slice(2, 4), 16)) +
    0.0722 * lin(parseInt(h.slice(4, 6), 16))
  );
};
const contrast = (a: string, b: string) => {
  const A = luminance(a);
  const B = luminance(b);
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
};

export default function ThemeEditorPage() {
  const managed = trpc.storefront.managed.useQuery();
  trpc.products.publicList.useQuery();
  const saveDraft = trpc.storefront.saveDraft.useMutation();
  const publish = trpc.storefront.publish.useMutation();
  const rollback = trpc.storefront.rollback.useMutation();
  const utils = trpc.useUtils();

  const [baseConfig, setBaseConfig] = useState<StorefrontConfig | null>(null);
  const [theme, setTheme] = useState<Record<string, unknown>>({});
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflict, setConflict] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<Category>("colors");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !managed.data?.draft?.config) return;
    setBaseConfig(managed.data.draft.config);
    setTheme((managed.data.draft.config.theme ?? {}) as Record<string, unknown>);
    setBaseVersion(managed.data.draft.version ?? 0);
    initialized.current = true;
  }, [managed.data]);

  const templateKey = baseConfig?.templateKey ?? "modern";
  const defaults = templateDefaultTokens(templateKey);
  const colors = (theme.colors ?? {}) as Record<string, string>;
  const radius = (theme.radius ?? {}) as Record<string, string>;
  const fontFamilies = (theme.fontFamilies ?? {}) as Record<string, string>;
  const effective = (token: string) => colors[token] ?? defaults[token] ?? "#000000";

  const previewStyle = useMemo(
    () => ({ ...defaults, ...buildStorefrontTokenOverrides(theme) }) as CSSProperties,
    [defaults, theme]
  );

  const patchTheme = (patch: Record<string, unknown>) => {
    setTheme(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const setColor = (token: string, value: string) =>
    patchTheme({ colors: { ...colors, [token]: value } });
  const setRadius = (token: string, value: string) =>
    patchTheme({ radius: { ...radius, [token]: value } });
  const setFont = (value: string) =>
    patchTheme({ fontFamilies: { ...fontFamilies, "--sf-font-heading": value } });

  useEffect(() => {
    if (!baseConfig || !dirty || conflict !== null) return;
    const handle = setTimeout(async () => {
      try {
        setSaving(true);
        const valid = validateStorefrontThemeConfig(theme);
        const res = await saveDraft.mutateAsync({
          config: { ...baseConfig, theme: valid.ok ? valid.data : {} },
          expectedVersion: baseVersion,
        });
        if (res.conflict) setConflict(res.currentVersion ?? 0);
        else {
          setBaseVersion(res.version ?? baseVersion);
          setDirty(false);
        }
      } catch {
        /* retry */
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [theme, dirty, conflict, baseVersion, baseConfig, saveDraft]);

  const doPublish = async () => {
    try {
      const res = await publish.mutateAsync({});
      toast.success(`تم نشر الثيم — الإصدار ${res.versionNumber}`);
      await utils.storefront.managed.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النشر.");
    }
  };
  const doRollback = async (versionNumber: number) => {
    try {
      const res = await rollback.mutateAsync({ versionNumber });
      toast.success(`تم التراجع — الإصدار ${res.versionNumber}`);
      await utils.storefront.managed.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التراجع.");
    }
  };

  if (managed.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea]">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }
  if (!baseConfig) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f1ea] px-6 text-center">
        <div>
          <p className="text-[15px] font-black">لا توجد مسودة قالب بعد. اختر قالبًا وفعّله أولًا.</p>
          <Link href="/templates">
            <Button className="mt-4">فتح القوالب</Button>
          </Link>
        </div>
      </div>
    );
  }

  const storeName = "المتجر";
  const preview = (
    <div data-sf-root style={previewStyle} className="pointer-events-none">
      {templateKey === "minimal" ? (
        <MinimalStorefront config={baseConfig} storeName={storeName} />
      ) : templateKey === "bold" ? (
        <BoldStorefront config={baseConfig} storeName={storeName} />
      ) : templateKey === "boutique" ? (
        <BoutiqueStorefront config={baseConfig} storeName={storeName} />
      ) : (
        <ModernStorefront config={baseConfig} storeName={storeName} />
      )}
    </div>
  );

  const pairs: Array<[string, string, string]> = [
    ["النص على الخلفية", effective("--sf-color-text"), effective("--sf-color-background")],
    ["نص الزر على الأساسي", effective("--sf-color-primary-foreground") || "#FFFFFF", effective("--sf-color-primary")],
    ["التمييز على الخلفية", effective("--sf-color-accent"), effective("--sf-color-background")],
    ["الأساسي على الخلفية", effective("--sf-color-primary"), effective("--sf-color-background")],
  ];

  const unimplemented = (
    <p className="rounded-xl bg-[#f7faf9] p-3 text-[11.5px] leading-6 text-[#576B66]">
      هذه الفئة معرّفة في عقد الثيم، لكن واجهة تحريرها لم تُبنَ بعد. المتاح الآن:
      الألوان، الطباعة (خط العناوين)، والحواف.
    </p>
  );

  return (
    <div dir="rtl" className="flex h-screen flex-col bg-[#f4f1ea] text-[#0C2A26]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e9e8] bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link
            href="/store/builder"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#576B66]"
          >
            <ArrowRight className="size-4" /> رجوع
          </Link>
          <span className="text-[14px] font-black">محرّر ثيم المتجر</span>
          <span className="rounded-full bg-[#e4f3ef] px-2.5 py-1 text-[11px] font-bold text-[#0B5D57]">
            القالب: {templateKey}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#576B66]">
            <span className={`size-2 rounded-full ${dirty ? "bg-[#d97706]" : "bg-[#0F766E]"}`} />
            {saving ? "جارٍ الحفظ…" : dirty ? "غير محفوظ" : "محفوظ"}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              setTheme({});
              setDirty(true);
            }}
            className="h-9 gap-1.5 rounded-lg px-3 text-xs font-extrabold"
          >
            <RotateCcw className="size-4" /> إعادة تعيين
          </Button>
          <Button
            onClick={doPublish}
            disabled={publish.isPending || conflict !== null}
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

      {conflict !== null ? (
        <div className="bg-[#FEF3E2] px-3.5 py-2 text-[12.5px] font-bold text-[#8A4B00]">
          المسودة تغيّرت من مكان آخر (نسخة {conflict}). أوقفنا الحفظ التلقائي.
        </div>
      ) : null}
      {templateKey === "bold" ? (
        <div className="bg-[#f7faf9] px-3.5 py-2 text-[11.5px] text-[#576B66]">
          ملاحظة: خلفيات Bold الداكنة (الهيرو/الترويسة/التذييل) جزء ثابت من هوية
          القالب ولا تتغيّر مع توكن «الخلفية».
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr_340px]">
        {/* Categories (RTL start / right) */}
        <aside className="hidden min-h-0 flex-col overflow-hidden border-inline-start border-[#e7e9e8] bg-white lg:flex">
          <div className="border-b border-[#e7e9e8] px-3.5 py-3 text-[13.5px] font-black">
            فئات الثيم
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex w-full items-center gap-2.5 border-b border-[#f1f3f2] px-3.5 py-3 text-right text-[13px] font-bold ${
                  category === c.id ? "bg-[#e4f3ef] text-[#0B5D57]" : "text-[#2F433F]"
                }`}
              >
                <span className="grid size-6 place-items-center rounded-lg bg-[#f1f3f2] text-[12px]">
                  {c.icon}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Live preview (center) */}
        <main className="min-h-0 overflow-auto p-4">
          <p className="mb-3 text-center text-[11.5px] font-bold text-[#576B66]">
            معاينة حيّة (المسودة)
          </p>
          <div className="mx-auto max-w-[900px] overflow-hidden rounded-[18px] border border-[#e7e9e8] shadow-[0_24px_60px_-40px_rgba(12,42,38,0.5)]">
            {preview}
          </div>
        </main>

        {/* Controls (RTL end / left) */}
        <aside className="min-h-0 overflow-y-auto border-inline-end border-[#e7e9e8] bg-white">
          <div className="border-b border-[#e7e9e8] px-3.5 py-3 text-[13.5px] font-black">
            {CATEGORIES.find(c => c.id === category)?.label}
          </div>

          {category === "colors" ? (
            <>
              <div className="space-y-3 p-3.5">
                {COLOR_FIELDS.map(field => {
                  const value = effective(field.token);
                  const safe = HEX.test(value) ? value : "#000000";
                  return (
                    <div key={field.token}>
                      <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={safe}
                          onChange={e => setColor(field.token, e.target.value)}
                          className="h-10 w-12 cursor-pointer rounded-lg border border-[#e7e9e8] bg-white p-1"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={e => setColor(field.token, e.target.value)}
                          className="flex-1 rounded-[10px] border border-[#e7e9e8] p-2.5 text-[12.5px] outline-none focus:border-[#0F766E]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-y border-[#e7e9e8] px-3.5 py-3 text-[12.5px] font-black">
                نسبة التباين (WCAG AA)
              </div>
              <div className="space-y-2 p-3.5">
                {pairs.map(([label, a, b]) => {
                  if (!HEX.test(a) || !HEX.test(b)) return null;
                  const ratio = contrast(a, b);
                  const ok = ratio >= 4.5;
                  return (
                    <div key={label} className="flex items-center justify-between gap-2 text-[12px]">
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        <b>{ratio.toFixed(2)}:1</b>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                            ok ? "bg-[#e4f3ef] text-[#0B5D57]" : "bg-[#fdeaea] text-[#B03A2E]"
                          }`}
                        >
                          {ok ? "AA ✓" : "تحذير <4.5"}
                        </span>
                      </span>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-[#576B66]">التحذير بصري فقط ولا يمنع الحفظ.</p>
              </div>
            </>
          ) : null}

          {category === "typography" ? (
            <div className="space-y-3 p-3.5">
              <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                خط العناوين
              </label>
              <select
                value={fontFamilies["--sf-font-heading"] ?? ""}
                onChange={e => setFont(e.target.value)}
                className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold"
              >
                <option value="">افتراضي القالب</option>
                {FONT_OPTIONS.map(f => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {category === "radius" ? (
            <div className="space-y-3 p-3.5">
              <label className="mb-1.5 block text-[11.5px] font-bold text-[#576B66]">
                انحناء حواف البطاقات (px)
              </label>
              <input
                type="number"
                value={parseInt(radius["--sf-radius-lg"] ?? defaults["--sf-radius-lg"] ?? "22", 10)}
                onChange={e => setRadius("--sf-radius-lg", `${Number(e.target.value) || 0}px`)}
                className="h-10 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
              />
              <p className="text-[11px] text-[#576B66]">
                الحواف مصدرها الوحيد توكن الثيم (لا يوجد إعداد حواف لكل قسم).
              </p>
            </div>
          ) : null}

          {category !== "colors" && category !== "typography" && category !== "radius" ? (
            <div className="p-3.5">{unimplemented}</div>
          ) : null}

          {/* Version history + rollback */}
          <div className="border-y border-[#e7e9e8] px-3.5 py-3 text-[12.5px] font-black">
            سجل الإصدارات
          </div>
          <div className="space-y-2 p-3.5">
            {(managed.data?.versions ?? []).slice(0, 8).map(v => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#e7e9e8] p-2.5"
              >
                <span className="text-[12px] font-bold">v{v.versionNumber}</span>
                <Button
                  variant="outline"
                  onClick={() => doRollback(v.versionNumber)}
                  disabled={rollback.isPending}
                  className="h-8 gap-1 rounded-lg px-2.5 text-[11px] font-extrabold"
                >
                  <Undo2 className="size-3.5" /> تراجع
                </Button>
              </div>
            ))}
            {!managed.data?.versions.length ? (
              <p className="text-[12px] text-[#576B66]">لا توجد إصدارات منشورة بعد.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
