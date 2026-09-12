import { MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeContactNumber } from "@/components/ContactBar";

type PublicTrackingBox = {
  trackTitle: string;
  trackHint: string;
  trackCta: string;
  trackMessage: string;
  activeNumber: string;
};

export function OrderTrackingBox({
  productId,
  orderNumber,
}: {
  productId: number;
  orderNumber: string;
}) {
  const optionalApi = (
    trpc as unknown as {
      trackingRetarget?: {
        publicForProduct?: {
          useQuery: (input: { productId: number }) => {
            data?: PublicTrackingBox | null;
          };
        };
      };
    }
  ).trackingRetarget;
  const query = optionalApi?.publicForProduct?.useQuery({ productId }) ?? {
    data: undefined,
  };
  const settings = query.data;
  const active = settings?.activeNumber
    ? normalizeContactNumber(settings.activeNumber)
    : "";
  if (!settings || active.length < 9) return null;
  const message = (
    settings.trackMessage || "مرحبًا، أريد تتبع طلبية رقم {orderNumber}"
  ).replaceAll("{orderNumber}", orderNumber);
  const href = `https://wa.me/${active}?text=${encodeURIComponent(message)}`;
  return (
    <div
      dir="rtl"
      className="mt-4 overflow-hidden rounded-2xl border border-[#CFEADD] bg-gradient-to-l from-[#1FA463] to-[#17A05B] p-4 text-white shadow-soft"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">
            {settings.trackTitle || "تتبع طلبك عبر واتساب"}
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-white/85">
            {settings.trackHint ||
              "أرسل رقم طلبك وسنرد عليك مباشرة بمتابعة طلبك لحظة بلحظة."}
          </p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-[#0E7A41] transition hover:bg-[#F0FAF5]"
      >
        <MessageCircle className="size-4" />
        {settings.trackCta || "تتبع طلبك الآن"}
      </a>
    </div>
  );
}
