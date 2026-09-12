import { CheckCircle2, X } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

type ThankYouPopupProps = {
  productId: number;
  orderNumber: string;
  total: string;
  onClose?: () => void;
};

function resolveButtonUrl(template: string, orderNumber: string) {
  const resolved = template.replaceAll(
    "{orderNumber}",
    encodeURIComponent(orderNumber)
  );
  if (resolved.startsWith("/") || /^https?:\/\//i.test(resolved))
    return resolved;
  return "/";
}

export function ThankYouPopup({
  productId,
  orderNumber,
  total,
  onClose,
}: ThankYouPopupProps) {
  const { data, isLoading } = trpc.thankYou.publicForProduct.useQuery({
    productId,
  });
  const defaultSettings = {
    enabled: true,
    message: "تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت. شكرًا لثقتك بنا.",
    buttonText: "خروج",
    buttonUrl: "/",
  };
  const buttonUrl = useMemo(
    () =>
      resolveButtonUrl(
        data?.buttonUrl ?? defaultSettings.buttonUrl,
        orderNumber
      ),
    [data?.buttonUrl, orderNumber]
  );
  if (isLoading) return null;
  const settings = data ?? defaultSettings;
  if (!settings.enabled) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="thank-you-title"
      dir="rtl"
      className="fixed inset-0 z-[80] grid place-items-center bg-[#0E1B15]/55 p-4 backdrop-blur-sm"
    >
      <div className="animate-check-pop relative w-full max-w-md overflow-hidden rounded-[30px] border border-[#E3EDE7] bg-white p-6 text-center shadow-lift sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-[var(--brand)] via-[#2E9B6F] to-[var(--brand)]" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الشكر"
            className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-[#F2F1EB] text-[#79837D] transition hover:bg-[#E7E5DC] active:scale-95"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <CheckCircle2 className="size-8" />
        </div>
        <p className="mt-5 text-xs font-black tracking-[.14em] text-[var(--brand)]">
          THANK YOU
        </p>
        <h2
          id="thank-you-title"
          className="mt-2 text-2xl font-black text-[var(--ink)]"
        >
          تم استلام طلبك
        </h2>
        <p className="mt-4 text-sm leading-7 text-[#66716B]">
          {settings.message}
        </p>
        <div className="mt-5 rounded-2xl border border-[#E3EDE7] bg-[var(--brand-soft)] px-4 py-3">
          <p className="text-[11px] font-bold text-[#5F7A6D]">رقم الطلب</p>
          <p className="mt-1 text-lg font-black tracking-wide text-[var(--brand-strong)]">
            {orderNumber}
          </p>
          <p className="mt-1 text-xs font-bold text-[#4A6257]">
            الإجمالي:{" "}
            {new Intl.NumberFormat("ar-DZ", {
              maximumFractionDigits: 2,
            }).format(Number(total))}{" "}
            دج
          </p>
        </div>
        <a
          href={buttonUrl}
          className="btn-press mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-sm font-black text-white shadow-cta"
        >
          {settings.buttonText}
        </a>
      </div>
    </div>
  );
}

export { resolveButtonUrl };
