import { useEffect, useState } from "react";

/**
 * The single color control used by every editor (theme, section settings,
 * categories, benefits, signature, legacy builders).
 *
 * The text input keeps its raw draft LOCALLY and only commits values that pass
 * the same rule as the theme schema (`colorValueSchema`). Committing a
 * half-typed hex (e.g. "#941f0") made the whole storefront config invalid,
 * which silently dropped every override — the cause of "changing one color did
 * nothing / changed the text color" reports.
 */
export const isValidColorValue = (value: string) =>
  /^#[0-9a-fA-F]{3,8}$/.test(value) ||
  /^oklch\([^()]*\)$/.test(value) ||
  /^rgba?\([^()]*\)$/.test(value) ||
  /^hsla?\([^()]*\)$/.test(value) ||
  value === "transparent" ||
  value === "currentColor";

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function ColorField({
  value,
  onChange,
  defaultValue,
  compact,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Effective template default: shown as the starting value/placeholder. */
  defaultValue?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // An external reset (e.g. "نوع الخلفية" back to the template default) must
  // win over a stale local draft, otherwise the cleared value keeps showing.
  useEffect(() => {
    if (!value) setDraft(null);
  }, [value]);
  const shown = draft ?? value ?? "";
  const preview =
    (isHex(shown) && shown) ||
    (isHex(defaultValue ?? "") ? (defaultValue as string) : "") ||
    "#ffffff";

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={preview}
        onChange={event => {
          setDraft(null);
          onChange(event.target.value);
        }}
        aria-label={ariaLabel}
        className={`shrink-0 cursor-pointer rounded-lg border border-[#e7e9e8] bg-white p-1 ${
          compact ? "h-9 w-10" : "h-10 w-12"
        }`}
      />
      <input
        type="text"
        dir="ltr"
        value={shown}
        placeholder={defaultValue ? `افتراضي: ${defaultValue}` : "بدون"}
        onChange={event => {
          const raw = event.target.value;
          setDraft(raw);
          const clean = raw.trim();
          if (isValidColorValue(clean)) onChange(clean);
        }}
        onBlur={() => setDraft(null)}
        className={`flex-1 rounded-[10px] border border-[#e7e9e8] outline-none focus:border-[#0F766E] ${
          compact ? "px-2 py-2 text-[12.5px]" : "p-2.5 text-[12.5px]"
        }`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            onChange("");
          }}
          title="رجوع للافتراضي"
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-[#0B5D57] hover:bg-[#f7faf9]"
        >
          افتراضي
        </button>
      ) : null}
    </div>
  );
}
