import { presentationNotice } from "@/config/store";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: PageIntroProps) {
  return (
    <section className="mb-7 flex w-full min-w-0 max-w-full flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        <p className="mb-2 text-xs font-extrabold tracking-[0.06em] text-[var(--brand)]">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[#1F2A25] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#79837D]">{description}</p>
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </section>
  );
}

export function PresentationNotice() {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] px-4 py-3 text-xs font-medium leading-5 text-[#7A5B34]">
      <Info className="size-4 shrink-0 text-[var(--warm)]" />
      <span>{presentationNotice}</span>
    </div>
  );
}
