import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex w-full min-h-72 min-w-0 max-w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-[#D8DCD0] bg-white px-6 py-10 text-center shadow-soft">
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="size-6" />
      </div>
      <h2 className="mt-5 text-base font-extrabold text-[#1F2A25]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#79837D]">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
