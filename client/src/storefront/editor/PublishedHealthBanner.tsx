import { AlertTriangle } from "lucide-react";

export interface PublishedHealthView {
  ok: boolean;
  latestVersionNumber: number | null;
  servedVersionNumber: number | null;
}

/**
 * Merchant-facing warning: the newest PUBLISHED snapshot is corrupt/invalid and
 * the live storefront is rendering an earlier version (or the Modern fallback).
 * Nothing is broken on the public side — this only tells the merchant why their
 * latest publish is not the one being served.
 */
export function PublishedHealthBanner({
  health,
}: {
  health?: PublishedHealthView | null;
}) {
  if (!health || health.ok) return null;
  const served = health.servedVersionNumber
    ? `الإصدار v${health.servedVersionNumber}`
    : "نسخة بديلة (Modern)";
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-[#f3d9a6] bg-[#fff7e6] px-3.5 py-2 text-[12.5px] font-bold text-[#8a5a00]"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        النسخة المنشورة فاسدة — المتجر يعرض نسخة بديلة ({served}). افتح المحرر وأعِد
        النشر لتصحيح ذلك.
      </span>
    </div>
  );
}
