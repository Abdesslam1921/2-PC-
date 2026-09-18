import { useMemo, useState } from "react";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

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
  { token: "--sf-color-background", label: "الخلفية" },
  { token: "--sf-color-surface", label: "السطح" },
  { token: "--sf-color-text", label: "النص" },
  { token: "--sf-color-text-muted", label: "النص الباهت" },
  { token: "--sf-color-accent", label: "التمييز" },
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
function DefaultToggle({
  isDefault,
  onToggle,
}: {
  isDefault: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10.5px] font-bold text-[#576B66]">
      <input
        type="checkbox"
        checked={isDefault}
        onChange={e => onToggle(e.target.checked)}
        className="size-3 accent-[#0F766E]"
      />
      افتراضي
    </label>
  );
}

export function ThemePanel({
  config,
  onChange,
}: {
  config: StorefrontConfig;
  onChange: (next: StorefrontConfig) => void;
}) {
  const [category, setCategory] = useState<Category>("colors");
  const theme = (config.theme ?? {}) as Record<string, unknown>;
  const defaults = useMemo(
    () => templateDefaultTokens(config.templateKey),
    [config.templateKey]
  );
  const colors = (theme.colors ?? {}) as Record<string, string>;
  const radius = (theme.radius ?? {}) as Record<string, string>;
  const fontFamilies = (theme.fontFamilies ?? {}) as Record<string, string>;
  const spacingTokens = (theme.spacing ?? {}) as Record<string, string>;
  const spacingPad = spacingTokens["--sf-space-section"] ?? "";
  const effective = (token: string) => colors[token] ?? defaults[token] ?? "#000000";

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

  const pairs: Array<[string, string, string]> = [
    ["النص على الخلفية", effective("--sf-color-text"), effective("--sf-color-background")],
    ["نص الزر على الأساسي", effective("--sf-color-primary-foreground") || "#FFFFFF", effective("--sf-color-primary")],
    ["التمييز على الخلفية", effective("--sf-color-accent"), effective("--sf-color-background")],
    ["الأساسي على الخلفية", effective("--sf-color-primary"), effective("--sf-color-background")],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#e7e9e8] px-3.5 py-3 text-[13.5px] font-black">الثيم</div>
      <div className="flex flex-wrap gap-1.5 border-b border-[#e7e9e8] px-3.5 py-3">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-extrabold ${
              category === c.id
                ? "border-[#0F766E] bg-[#e4f3ef] text-[#0B5D57]"
                : "border-[#e7e9e8] bg-white text-[#576B66]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {category === "colors" ? (
          <>
            <div className="space-y-3 p-3.5">
              {COLOR_FIELDS.map(field => {
                const value = effective(field.token);
                const safe = HEX.test(value) ? value : "#000000";
                const isDefault = !(field.token in colors);
                return (
                  <div key={field.token}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-[11.5px] font-bold text-[#576B66]">
                        {field.label}
                      </label>
                      <DefaultToggle
                        isDefault={isDefault}
                        onToggle={next =>
                          setToken(
                            "colors",
                            field.token,
                            next ? undefined : defaults[field.token] ?? "#000000"
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={safe}
                        disabled={isDefault}
                        onChange={e => setColor(field.token, e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-lg border border-[#e7e9e8] bg-white p-1 disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={value}
                        disabled={isDefault}
                        onChange={e => setColor(field.token, e.target.value)}
                        className="flex-1 rounded-[10px] border border-[#e7e9e8] p-2.5 text-[12.5px] outline-none focus:border-[#0F766E] disabled:opacity-60"
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
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11.5px] font-bold text-[#576B66]">
                خط العناوين
              </label>
              <DefaultToggle
                isDefault={!fontFamilies["--sf-font-heading"]}
                onToggle={next =>
                  setToken(
                    "fontFamilies",
                    "--sf-font-heading",
                    next ? undefined : "Cairo"
                  )
                }
              />
            </div>
            <select
              value={fontFamilies["--sf-font-heading"] ?? ""}
              disabled={!fontFamilies["--sf-font-heading"]}
              onChange={e => setFont(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold disabled:opacity-60"
            >
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
              <DefaultToggle
                isDefault={!radius["--sf-radius-lg"]}
                onToggle={next =>
                  setToken(
                    "radius",
                    "--sf-radius-lg",
                    next
                      ? undefined
                      : `${parseInt(defaults["--sf-radius-lg"] ?? "22", 10)}px`
                  )
                }
              />
            </div>
            <input
              type="number"
              disabled={!radius["--sf-radius-lg"]}
              value={parseInt(radius["--sf-radius-lg"] ?? defaults["--sf-radius-lg"] ?? "22", 10)}
              onChange={e => setToken("radius", "--sf-radius-lg", `${Number(e.target.value) || 0}px`)}
              className="h-10 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E] disabled:opacity-60"
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
                      <DefaultToggle
                        isDefault={isDefault}
                        onToggle={next => {
                          if (next) setToken(ctrl.group, ctrl.token, undefined);
                        }}
                      />
                    </div>
                    <select
                      value={current}
                      disabled={isDefault}
                      onChange={e => setToken(ctrl.group, ctrl.token, e.target.value || undefined)}
                      className="h-10 w-full rounded-[10px] border border-[#e7e9e8] bg-white px-2 text-[13px] font-bold disabled:opacity-60"
                    >
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
                <div key={ctrl.token}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-[11.5px] font-bold text-[#576B66]">
                      {ctrl.label}
                    </label>
                    <DefaultToggle
                      isDefault={isDefault}
                      onToggle={next => {
                        if (next) setToken(ctrl.group, ctrl.token, undefined);
                      }}
                    />
                  </div>
                  <input
                    type="number"
                    disabled={isDefault}
                    value={current ? parseInt(current, 10) : ""}
                    onChange={e => setToken(ctrl.group, ctrl.token, e.target.value ? `${Number(e.target.value)}${unit}` : undefined)}
                    className="h-10 w-full rounded-[10px] border border-[#e7e9e8] p-2.5 text-[13px] outline-none focus:border-[#0F766E] disabled:opacity-60"
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
              <DefaultToggle
                isDefault={!spacingPad}
                onToggle={next => {
                  if (next) setToken("spacing", "--sf-space-section", undefined);
                }}
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
    </div>
  );
}
