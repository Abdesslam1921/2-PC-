import { storeConfig } from "@/config/store";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLockup({
  compact = false,
  className = "",
}: BrandLockupProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-base font-extrabold text-white shadow-cta">
        {storeConfig.shortName}
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-[#182420]">
            {storeConfig.name}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[#79837D]">
            {storeConfig.description}
          </p>
        </div>
      )}
    </div>
  );
}
