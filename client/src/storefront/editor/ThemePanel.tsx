import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import { ColorField } from "@/storefront/editor/ColorField";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

type SavedTheme = {
  id: string;
  name: string;
  theme: Record<string, unknown>;
  savedAt: string;
};
const SAVED_THEMES_KEY = "sf-saved-themes";
const MAX_SAVED_THEMES = 3;

function readSavedThemes(): SavedTheme[] {
  try {
    const raw = localStorage.getItem(SAVED_THEMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED_THEMES) : [];
  } catch {
    return [];
  }
}
function writeSavedThemes(list: SavedTheme[]) {
  try {
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(list.slice(0, MAX_SAVED_THEMES)));
  } catch {
    /* ignore quota errors */
  }
}

type Category =
  | "colors"
  | "typography"
  | "radius"
  | "spacing"
  | "layout"
  | "borders"
  | "effects"
  | "density";

const CATEGORIES: Array<{ id: Category; label: string; icon: string }> = [
  { id: "colors", label: "الألوان", icon: "◐" },
  { id: "typography", label: "الطباعة", icon: "Aa" },
  { id: "radius", label: "الحواف", icon: "◜" },
  { id: "spacing", label: "المسافات", icon: "↔" },
  { id: "layout", label: "التخطيط", icon: "▭" },
  { id: "borders", label: "الحدود", icon: "▤" },
  { id: "effects", label: "الظلال والتأثيرات", icon: "✷" },
  { id: "density", label: "الكثافة", icon: "≣" },
];

const COLOR_FIELDS: Array<{ token: string; label: string }> = [
  { token: "--sf-color-primary", label: "اللون الأساسي" },
  { token: "--sf-color-primary-hover", label: "الأساسي (عند المرور)" },
  { token: "--sf-color-primary-foreground", label: "نص الزر على الأساسي" },
  { token: "--sf-color-background", label: "الخلفية" },
  { token: "--sf-color-surface", label: "السطح" },
  { token: "--sf-color-surface-raised", label: "السطح البارز (الأشرطة الداكنة)" },
  { token: "--sf-color-surface-muted", label: "السطح الباهت" },
  { token: "--sf-color-text", label: "النص الأساسي" },
  { token: "--sf-color-text-muted", label: "النص الباهت" },
  { token: "--sf-color-text-inverted", label: "النص على السطح الداكن" },
  { token: "--sf-color-accent", label: "التمييز" },
  { token: "--sf-color-accent-soft", label: "التمييز الفاتح (الإطارات)" },
];
const FONT_OPTIONS = ["Cairo", "Tajawal", "Rubik"];

type Ctrl = {
  group: string;
  token: string;
  label: string;
  type: "px" | "ms" | "select";
  options?: Array<{ value: string; label: string }>;
};
const CONTROLS: Record<Category, Ctrl[]> = {
  colors: [],
  typography: [],
  radius: [],
  spacing: [
    { group: "spacing", token: "--sf-space-section", label: "المسافة الرأسية بين الأقسام (px)", type: "px" },
  ],
  layout: [
    { group: "layout", token: "--sf-container-max", label: "أقصى عرض للمحتوى (px)", type: "px" },
  ],
  borders: [
    { group: "borders", token: "--sf-border-width-base", label: "سماكة حدود الأقسام (px)", type: "px" },
    {
      group: "borders",
      token: "--sf-border-style",
      label: "نمط الحدود",
      type: "select",
      options: [
        { value: "solid", label: "متصل" },
        { value: "dashed", label: "متقطع" },
      ],
    },
  ],
  effects: [
    {
      group: "shadows",
      token: "--sf-shadow-soft",
      label: "ظل الأقسام",
      type: "select",
      options: [
        { value: "none", label: "بدون" },
        { value: "0 8px 24px rgba(12,42,38,0.10)", label: "ناعم" },
        { value: "0 20px 44px rgba(12,42,38,0.22)", label: "قوي" },
      ],
    },
    { group: "effects", token: "--sf-effect-transition-base", label: "مدة الانتقال (ms)", type: "ms" },
  ],
  density: [],
};
const DENSITY_PRESETS = [
  { id: "compact", label: "مدمجة", pad: "40px" },
  { id: "comfortable", label: "مريحة", pad: "64px" },
  { id: "spacious", label: "واسعة", pad: "88px" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Which theme category owns a token, so a preview click can open it. */
function categoryForToken(token: string): Category | null {
  if (token.startsWith("--sf-color-")) return "colors";
  if (token.startsWith("--sf-font-")) return "typography";
  if (token.startsWith("--sf-radius-")) return "radius";
  if (token.startsWith("--sf-space-")) return "spacing";
  if (token.startsWith("--sf-container") || token.startsWith("--sf-grid"))
    return "layout";
  if (token.startsWith("--sf-border")) return "borders";
  if (token.startsWith("--sf-shadow") || token.startsWith("--sf-effect"))
    return "effects";
  return null;
}

/**
 * Same rule as the theme schema (`colorValueSchema`). The text input keeps its
 * raw draft locally and only commits values that pass this check — otherwise a
 * half-typed hex would make the whole theme object invalid, silently dropping
 * EVERY token override (which looked like "changing one color changed the text
 * color").
 */
const isValidColorValue = (value: string) =>
  /^#[0-9a-fA-F]{3,8}$/.test(value) ||
  /^oklch\([^()]*\)$/.test(value) ||
  /^rgba?\([^()]*\)$/.test(value) ||
  /^hsla?\([^()]*\)$/.test(value) ||
  value === "transparent" ||
  value === "currentColor";
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

/** "Use template default" checkbox: when checked, the token is removed. */
/**
 * The ONLY reset affordance per field: shown when an override exists (so it
 * always does something) and replaced by a plain hint of the effective value
 * when the field already follows the template default.
 */
function ResetOverride({
  isDefault,
  onReset,
  hint,
}: {
  isDefault: boolean;
  onReset: () => void;
  hint: string;
}) {
  if (isDefault) {
    return (
      <span className="shrink-0 text-[10.5px] font-bold text-[#9fb0ac]">افتراضي: {hint}</span>
    );
  }
  return (
    <button
      type="button"
      onClick={onReset}
      title="رجوع لافتراضي القالب"
      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-[#0B5D57] hover:bg-[#f7faf9]"
    >
      افتراضي
    </button>
  );
}

export function ThemePanel({
  config,
  onChange,
  focusToken,
  liveColors,
}: {
  config: StorefrontConfig;
  onChange: (next: StorefrontConfig) => void;
  /** Theme token clicked inside the preview: open its category and focus it. */
  focusToken?: { key: string; nonce: number } | null;
  /** Colors actually rendered by the selected section (preferred over defaults). */
  liveColors?: Record<string, string>;
}) {
  const [category, setCategory] = useState<Category>("colors");
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(() =>
    readSavedThemes()
  );
  const [themeName, setThemeName] = useState("");
  const tokenRefs = useRef<Record<string, HTMLElement | null>>({});
  const [flashToken, setFlashToken] = useState<string | null>(null);

  // Open the owning category, then scroll to + focus the clicked token control.
  useEffect(() => {
    if (!focusToken) return;
    const owner = categoryForToken(focusToken.key);
    if (owner && owner !== category) {
      setCategory(owner);
      return;
    }
    const el = tokenRefs.current[focusToken.key];
    if (!el) return;
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.querySelector<HTMLElement>(
      "input:not([type=file]), select, textarea"
    )?.focus({ preventScroll: true });
    setFlashToken(focusToken.key);
    const timer = setTimeout(() => setFlashToken(null), 1600);
    return () => clearTimeout(timer);
  }, [focusToken, category]);
  const theme = (config.theme ?? {}) as Record<string, unknown>;
  const defaults = useMemo(
    () => templateDefaultTokens(config.templateKey),
    [config.templateKey]
  );
  const colors = (theme.colors ?? {}) as Record<string, string>;
  const fills = (theme.fills ?? {}) as Record<string, string>;
  const brandFill = fills["--sf-brand-fill"];
  /** Solid vs gradient for every brand fill in all templates. */
  const brandFillIsGradient = brandFill
    ? brandFill.includes("gradient")
    : (defaults["--sf-brand-fill"] ?? "").includes("gradient");
  const setBrandFillMode = (mode: "solid" | "gradient") =>
    setToken(
      "fills",
      "--sf-brand-fill",
      mode === "gradient"
        ? "linear-gradient(135deg, var(--sf-color-primary), var(--sf-color-primary-hover))"
        : "none"
    );
  const radius = (theme.radius ?? {}) as Record<string, string>;
  const fontFamilies = (theme.fontFamilies ?? {}) as Record<string, string>;
  const spacingTokens = (theme.spacing ?? {}) as Record<string, string>;
  const spacingPad = spacingTokens["--sf-space-section"] ?? "";
  /**
   * Current value of a token: an explicit choice wins, then the color actually
   * rendered by the selected section, then the template default.
   */
  const effective = (token: string) =>
    colors[token] ?? liveColors?.[token] ?? defaults[token] ?? "#000000";

  const patchTheme = (patch: Record<string, unknown>) =>
    onChange({ ...config, theme: { ...theme, ...patch } });
  const setColor = (token: string, value: string) =>
    patchTheme({ colors: { ...colors, [token]: value } });
  const setFont = (value: string) =>
    patchTheme({ fontFamilies: { ...fontFamilies, "--sf-font-heading": value } });
  const setToken = (group: string, token: string, value?: string) => {
    const current = { ...((theme[group] as Record<string, string>) ?? {}) };
    if (!value) delete current[token];
    else current[token] = value;
    patchTheme({ [group]: current });
  };

  /** Reset the currently selected theme category to template defaults. */
  const resetCategory = () => {
    if (category === "density") {
      const next = { ...((theme.spacing as Record<string, string>) ?? {}) };
      delete next["--sf-space-section"];
      onChange({ ...config, theme: { ...theme, spacing: next } });
      return;
    }
    const groups: Record<Exclude<Category, "density">, string[]> = {
      colors: ["colors"],
      typography: ["fontFamilies"],
      radius: ["radius"],
      spacing: ["spacing"],
      layout: ["layout"],
      borders: ["borders"],
      effects: ["shadows", "effects"],
    };
    const nextTheme: Record<string, unknown> = { ...theme };
    for (const group of groups[category]) delete nextTheme[group];
    onChange({ ...config, theme: nextTheme });
  };

  /** Save the current theme under a name (max 3, stored in this browser). */
  const saveTheme = () => {
    if (savedThemes.length >= MAX_SAVED_THEMES) {
      toast.error("الحد الأقصى ٣ ثيمات محفوظة.");
      return;
    }
    const entry: SavedTheme = {
      id: Date.now().toString(36),
      name: themeName.trim() || `ثيم ${savedThemes.length + 1}`,
      theme: JSON.parse(JSON.stringify(theme)) as Record<string, unknown>,
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...savedThemes].slice(0, MAX_SAVED_THEMES);
    setSavedThemes(next);
    writeSavedThemes(next);
    setThemeName("");
    toast.success("تم حفظ الثيم.");
  };
  const restoreTheme = (saved: SavedTheme) => {
    onChange({
      ...config,
      theme: saved.theme as unknown as StorefrontConfig["theme"],
    });
    toast.success(`تم استرجاع «${saved.name}».`);
  };
  const deleteTheme = (id: string) => {
    const next = savedThemes.filter(t => t.id !== id);
    setSavedThemes(next);
    writeSavedThemes(next);
  };

  const pairs: Array<[string, string, string]> = [
    ["النص على الخلفية", effective("--sf-color-text"), effective("--sf-color-background")],
    ["نص الزر على الأساسي", effective("--sf-color-primary-foreground") || "#FFFFFF", effective("--sf-color-primary")],
    ["التمييز على الخلفية", effective("--sf-color-accent"), effective("--sf-color-background")],
    ["الأساسي على الخلفية", effective("--sf-color-primary"), effective("--sf-color-background")],
  ];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[#e7e9e8] px-3.5 py-3">
        <span className="text-[13.5px] font-black">الثيم</span>
        <button
          type="button"
          onClick={resetCategory}
          title="إعادة تعيين هذه الفئة لافتراضي القالب"
          className="grid size-7 place-items-center rounded-md text-[#0F766E] hover:bg-[#f7faf9]"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[#e7e9e8] px-3.5 py-3">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-4 py-2 text-[13px] font-extrabold ${
              category === c.id
                ? "border-[#0F766E] bg-[#e4f3ef] text-[#0B5D57]"
                : "border-[#e7e9e8] bg-white text-[#576B66]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div>
        {category === "colors" ? (
          <>
            <div className="space-y-3 p-3.5">
              {COLOR_FIELDS.map(field => {
                const value = effective(field.token);
                const isDefault = !(field.token in colors);
                return (
                  <div
                    key={field.token}
                    ref={el => {
                      tokenRefs.current[field.token] = el;
                    }}
                    className={`rounded-xl p-1 transition ${
                      flashToken === field.token
                        ? "bg-[#f0faf8] ring-2 ring-[#0F766E]/50"
                        : ""
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      {isDefault ? (
                        <span className="shrink-0 text-[10.5px] font-bold text-[#9fb0ac]">
                          افتراضي: {defaults[field.token] ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    <ColorField
                      value={value}
                      onChange={next => setColor(field.token, next)}
                      defaultValue={defaults[field.token]}
                      ariaLabel={field.label}
                    />
                  </div>
                );
              })}
            </div>

            {/* Global fill style: solid vs gradient for every brand surface. */}
            <div className="border-t border-[#e7e9e8] px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-black">تعبئة العلامة</span>
                <ResetOverride
                  isDefault={!brandFill}
                  onReset={() => setToken("fills", "--sf-brand-fill", undefined)}
                  hint={
                    (defaults["--sf-brand-fill"] ?? "").includes("gradient")
                      ? "متدرّج"
                      : "لون صلب"
                  }
                />
              </div>
              <div className="inline-flex rounded-[10px] bg-[#f1f3f2] p-1">
                <button
                  type="button"
                  onClick={() => setBrandFillMode("solid")}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-bold ${
                    !brandFillIsGradient ? "bg-white text-[#0C2A26]" : "text-[#576B66]"
                  }`}
                >
                  لون صلب
                </button>
                <button
                  type="button"
                  onClick={() => setBrandFillMode("gradient")}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-bold ${
                    brandFillIsGradient ? "bg-white text-[#0C2A26]" : "text-[#576B66]"
                  }`}
                >
                  متدرّج
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-6 text-[#576B66]">
                يتحكم في تعبئة الواجهة/الشريط/الأزرار في القوالب كلها (من
                «الأساسي» إلى «الأساسي عند المرور»). وللتخصيص لقسم واحد استخدم
                «خلفية القسم» في المحتوى.
              </p>
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
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11.5px] font-bold text-[#576B66]">
                خط العناوين
              </label>
              <span className="shrink-0 text-[10.5px] font-bold text-[#9fb0ac]">
                افتراضي: Cairo
              </span>
            </div>
            <select
              value={fontFamilies["--sf-font-heading"] ?? ""}
              onChange={e => setFont(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold"
            >
              <option value="">افتراضي</option>
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
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11.5px] font-bold text-[#576B66]">
                انحناء حواف البطاقات (px)
              </label>
              <ResetOverride
                isDefault={!radius["--sf-radius-lg"]}
                onReset={() => setToken("radius", "--sf-radius-lg", undefined)}
                hint={`${parseInt(defaults["--sf-radius-lg"] ?? "22", 10)}px`}
              />
            </div>
            <input
              type="number"
              value={radius["--sf-radius-lg"] ? parseInt(radius["--sf-radius-lg"], 10) : ""}
              placeholder={`افتراضي: ${parseInt(defaults["--sf-radius-lg"] ?? "22", 10)}`}
              onChange={e =>
                setToken(
                  "radius",
                  "--sf-radius-lg",
                  e.target.value ? `${Number(e.target.value)}px` : undefined
                )
              }
              className="h-10 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
            />
            <p className="text-[11px] text-[#576B66]">
              الحواف مصدرها الوحيد توكن الثيم (لا يوجد إعداد حواف لكل قسم).
            </p>
          </div>
        ) : null}

        {["spacing", "layout", "borders", "effects"].includes(category) ? (
          <div className="space-y-3 p-3.5">
            {CONTROLS[category].map(ctrl => {
              const current = ((theme[ctrl.group] as Record<string, string>) ?? {})[ctrl.token] ?? "";
              const isDefault = !current;
              if (ctrl.type === "select") {
                return (
                  <div key={ctrl.token}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-[11.5px] font-bold text-[#576B66]">
                        {ctrl.label}
                      </label>
                      <span className="shrink-0 text-[10.5px] font-bold text-[#9fb0ac]">
                        افتراضي: {defaults[ctrl.token] ?? "—"}
                      </span>
                    </div>
                    <select
                      value={current}
                      onChange={e => setToken(ctrl.group, ctrl.token, e.target.value || undefined)}
                      className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold"
                    >
                      <option value="">افتراضي</option>
                      {(ctrl.options ?? []).map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              const unit = ctrl.type === "ms" ? "ms" : "px";
              return (
                <div
                  key={ctrl.token}
                  ref={el => {
                    tokenRefs.current[ctrl.token] = el;
                  }}
                  className={`rounded-xl p-1 transition ${
                    flashToken === ctrl.token
                      ? "bg-[#f0faf8] ring-2 ring-[#0F766E]/50"
                      : ""
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-[11.5px] font-bold text-[#576B66]">
                      {ctrl.label}
                    </label>
                    <ResetOverride
                      isDefault={isDefault}
                      onReset={() => setToken(ctrl.group, ctrl.token, undefined)}
                      hint={defaults[ctrl.token] ?? "—"}
                    />
                  </div>
                  <input
                    type="number"
                    value={current ? parseInt(current, 10) : ""}
                    placeholder={`افتراضي: ${defaults[ctrl.token] ?? ""}`}
                    onChange={e => setToken(ctrl.group, ctrl.token, e.target.value ? `${Number(e.target.value)}${unit}` : undefined)}
                    className="h-10 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
                  />
                </div>
              );
            })}
            <p className="text-[11px] text-[#576B66]">
              تُطبَّق على الأقسام مباشرةً؛ وعند غياب القيمة يبقى مظهر القالب كما هو.
            </p>
          </div>
        ) : null}

        {category === "density" ? (
          <div className="space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11.5px] font-bold text-[#576B66]">الكثافة</label>
              <ResetOverride
                isDefault={!spacingPad}
                onReset={() => setToken("spacing", "--sf-space-section", undefined)}
                hint="افتراضي القالب"
              />
            </div>
            <div className="inline-flex rounded-[10px] bg-[#f1f3f2] p-1">
              {DENSITY_PRESETS.map(d => {
                const active = spacingPad === d.pad;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setToken("spacing", "--sf-space-section", d.pad)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                      active ? "bg-white text-[#0C2A26]" : "text-[#576B66]"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={spacingPad ? parseInt(spacingPad, 10) : ""}
                onChange={e =>
                  setToken(
                    "spacing",
                    "--sf-space-section",
                    e.target.value ? `${Number(e.target.value)}px` : undefined
                  )
                }
                className="h-10 w-28 rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E]"
              />
              <span className="text-[12px] font-bold text-[#576B66]">
                px (نفس رقم فئة «المسافات»)
              </span>
            </div>
            <p className="text-[11px] text-[#576B66]">
              الكثافة تُطبَّق حاليًا كمسافة رأسية للأقسام؛ وربطها الكامل بالمسافات
              يبقى مشروعًا منفصلًا.
            </p>
          </div>
        ) : null}
      </div>

      {/* Saved themes (max 3, browser-local) */}
      <div className="border-t border-[#e7e9e8] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-black">الثيمات المحفوظة</span>
          <span className="text-[11px] font-bold text-[#576B66]">
            {savedThemes.length}/{MAX_SAVED_THEMES}
          </span>
        </div>
        <div className="mb-2 flex gap-2">
          <input
            value={themeName}
            onChange={e => setThemeName(e.target.value)}
            placeholder="اسم الثيم"
            className="h-9 flex-1 rounded-lg border border-[#e7e9e8] px-2.5 text-[12.5px] outline-none focus:border-[#0F766E]"
          />
          <Button
            onClick={saveTheme}
            disabled={savedThemes.length >= MAX_SAVED_THEMES}
            className="h-9 rounded-lg px-3 text-xs font-extrabold"
          >
            حفظ الثيم
          </Button>
        </div>
        <div className="space-y-1.5">
          {savedThemes.length === 0 ? (
            <p className="text-[11.5px] text-[#576B66]">لا توجد ثيمات محفوظة بعد.</p>
          ) : null}
          {savedThemes.map(saved => (
            <div
              key={saved.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#e7e9e8] px-2.5 py-1.5"
            >
              <span className="truncate text-[12px] font-bold">{saved.name}</span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => restoreTheme(saved)}
                  className="rounded-md px-2 py-1 text-[11px] font-extrabold text-[#0B5D57] hover:bg-[#f7faf9]"
                >
                  استرجاع
                </button>
                <button
                  type="button"
                  onClick={() => deleteTheme(saved.id)}
                  className="rounded-md px-2 py-1 text-[11px] font-extrabold text-[#b03a2e] hover:bg-[#f7faf9]"
                >
                  حذف
                </button>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-[#8a938d]">
          محفوظة في هذا المتصفح (٣ كحد أقصى).
        </p>
      </div>
    </div>
  );
}
