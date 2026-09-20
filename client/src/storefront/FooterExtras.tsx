/**
 * Shared footer content blocks.
 *
 * Templates keep their own footer layout/tone and drop these fragments in, so
 * the editable footer fields (help answers, phone, social links, store links
 * with real destinations) behave the same in all four templates.
 */
import { useId } from "react";
import { footerData, phoneHref, whatsappHref } from "@/storefront/sectionData";
import type { StorefrontSection } from "@shared/storefront/storefrontConfig";

type Tone = {
  itemClass?: string;
  subClass?: string;
  mutedClass?: string;
};

/** Store links: "جديد" → products, "الفئات" → categories, "عروض" pending. */
export function FooterStoreLinks({
  footer,
  itemClass = "mb-2 block text-[13px]",
  mutedClass = "mb-2 block text-[13px] opacity-60",
}: { footer: ReturnType<typeof footerData> } & Tone) {
  return (
    <>
      <a href={footer.productsHref} className={itemClass}>
        جديد
      </a>
      <span className={mutedClass}>عروض</span>
      <a href={footer.categoriesHref} className={itemClass}>
        الفئات
      </a>
    </>
  );
}

/** Help column with the editable answer for each entry. */
export function FooterHelp({
  footer,
  itemClass = "mb-1 block text-[13px]",
  subClass = "mb-2 block text-[11.5px] opacity-80",
}: { footer: ReturnType<typeof footerData> } & Tone) {
  return (
    <>
      <span className={itemClass}>تتبع الطلب</span>
      {footer.trackOrder ? <span className={subClass}>{footer.trackOrder}</span> : null}
      <span className={itemClass}>سياسة الإرجاع</span>
      {footer.returns ? <span className={subClass}>{footer.returns}</span> : null}
      {footer.phone ? (
        <a href={phoneHref(footer.phone)} dir="ltr" className={itemClass}>
          {footer.phone}
        </a>
      ) : (
        <span className={itemClass}>اتصل بنا</span>
      )}
    </>
  );
}

/** Social column: real links when provided, otherwise muted labels. */
export function FooterSocial({
  footer,
  itemClass = "mb-2 block text-[13px]",
  mutedClass = "mb-2 block text-[13px] opacity-60",
}: { footer: ReturnType<typeof footerData> } & Tone) {
  const whatsapp = whatsappHref(footer.whatsapp);
  return (
    <>
      {footer.facebook ? (
        <a href={footer.facebook} target="_blank" rel="noreferrer" className={itemClass}>
          فيسبوك
        </a>
      ) : (
        <span className={mutedClass}>فيسبوك</span>
      )}
      {footer.instagram ? (
        <a href={footer.instagram} target="_blank" rel="noreferrer" className={itemClass}>
          إنستغرام
        </a>
      ) : (
        <span className={mutedClass}>إنستغرام</span>
      )}
      {whatsapp ? (
        <a href={whatsapp} target="_blank" rel="noreferrer" className={itemClass}>
          واتساب
        </a>
      ) : (
        <span className={mutedClass}>واتساب</span>
      )}
    </>
  );
}

/** Small inline social row for compact one-line footers. */
export function FooterInlineLinks({
  footer,
  itemClass = "",
}: { footer: ReturnType<typeof footerData> } & Tone) {
  const whatsapp = whatsappHref(footer.whatsapp);
  return (
    <>
      <a href={footer.productsHref} className={itemClass}>
        جديد
      </a>
      <span className="opacity-60">عروض</span>
      <a href={footer.categoriesHref} className={itemClass}>
        الفئات
      </a>
      {footer.facebook ? (
        <a href={footer.facebook} target="_blank" rel="noreferrer" className={itemClass}>
          فيسبوك
        </a>
      ) : null}
      {footer.instagram ? (
        <a href={footer.instagram} target="_blank" rel="noreferrer" className={itemClass}>
          إنستغرام
        </a>
      ) : null}
      {whatsapp ? (
        <a href={whatsapp} target="_blank" rel="noreferrer" className={itemClass}>
          واتساب
        </a>
      ) : null}
      {footer.phone ? (
        <a href={phoneHref(footer.phone)} dir="ltr" className={itemClass}>
          {footer.phone}
        </a>
      ) : null}
    </>
  );
}

/** Shared signature section markup (font + color are editable per section). */
/**
 * Decorative squiggle above the signature.
 *
 * Hand-drawn SVG (no ready-made ornament exists in the loaded web fonts) with a
 * gradient between the theme's primary and accent tokens, so it follows the
 * storefront theme instead of using a fixed color.
 */
export function SignatureFlourish({ className = "" }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 640 40"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`mx-auto block ${className}`}
      style={{ width: "min(420px, 74%)", height: 34 }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="640"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: "var(--sf-color-accent,#F5B13D)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--sf-color-primary,#14B8A6)" }} />
          <stop offset="1" style={{ stopColor: "var(--sf-color-accent,#F5B13D)" }} />
        </linearGradient>
      </defs>
      <path
        d="M8 28 C 90 6, 170 34, 250 20 C 330 6, 380 34, 452 20 C 512 8, 560 30, 632 16"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Signature text style.
 *
 * Defaults follow the theme tokens (same "explicit → template default" rule the
 * theme pickers use): the text color falls back to the theme text token and the
 * font to the theme heading font, and both stay overridable per section.
 */
export function signatureStyle(section: StorefrontSection) {
  const font = typeof section.settings.font === "string" ? section.settings.font : "";
  const color = typeof section.settings.color === "string" ? section.settings.color : "";
  const stacks: Record<string, string> = {
    greatvibes: '"Great Vibes", "Segoe Script", cursive',
    cairo: '"Cairo", "Tajawal", system-ui, sans-serif',
    tajawal: '"Tajawal", "Cairo", system-ui, sans-serif',
    rubik: '"Rubik", "Tajawal", system-ui, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", ui-monospace, monospace',
  };
  return {
    text: typeof section.settings.text === "string" ? section.settings.text : "",
    subtitle:
      typeof section.settings.subtitle === "string" ? section.settings.subtitle : "",
    /** Shown by default; only the explicit `false` hides it. */
    showOrnament: section.settings.showOrnament !== false,
    style: {
      fontFamily:
        font && stacks[font] ? stacks[font] : "var(--sf-font-heading, revert-layer)",
      color: color || "var(--sf-color-text, revert-layer)",
    },
  };
}
