import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Props = { productId?: number };

export function ContentGuard({ productId }: Props) {
  const contentGuardApi = (
    trpc as typeof trpc & { contentGuard?: typeof trpc.contentGuard }
  ).contentGuard;
  if (!contentGuardApi) return null;
  const { data } = contentGuardApi.publicForProduct.useQuery(
    { productId: productId ?? 0 },
    { enabled: Boolean(productId) }
  );
  const [blocked, setBlocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!data?.enabled) return;
    const isMetaLibrary =
      /(^|\.)facebook\.com$/i.test(
        new URL(document.referrer || "https://local.invalid").hostname
      ) && /ads\/library/i.test(document.referrer);
    const shouldBlock = data.blockMetaAdsLibrary && isMetaLibrary;
    setBlocked(shouldBlock);
    const onContextMenu = (event: MouseEvent) => {
      if (data.blockRightClick) event.preventDefault();
    };
    const onDragStart = (event: DragEvent) => {
      if (data.protectImages && event.target instanceof HTMLImageElement)
        event.preventDefault();
    };
    const onSelectStart = (event: Event) => {
      if (!data.preventSelection) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("selectstart", onSelectStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("selectstart", onSelectStart);
    };
  }, [data]);

  if (!data?.enabled || (!blocked && !data.watermarkEnabled)) return null;
  return (
    <>
      {data.watermarkEnabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[40] grid place-items-center overflow-hidden opacity-[0.08]"
        >
          <span className="rotate-[-24deg] whitespace-nowrap text-4xl font-black text-[#202238] [text-shadow:0_1px_0_white] sm:text-6xl">
            {data.watermarkText}
          </span>
        </div>
      )}
      {blocked && !dismissed && (
        <div
          role="alertdialog"
          aria-label="حماية المحتوى"
          className="fixed inset-0 z-[80] grid place-items-center bg-[#171827]/90 p-5 text-center backdrop-blur-sm"
        >
          <div
            className="relative w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl"
            dir="rtl"
          >
            <button
              type="button"
              aria-label="إغلاق رسالة الحماية"
              onClick={() => setDismissed(true)}
              className="absolute left-4 top-4 rounded-lg p-2 text-[#8B8DA0] hover:bg-[#F3F2F7]"
            >
              <X className="size-4" />
            </button>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF0F2] text-[#C55369]">
              <ShieldAlert className="size-7" />
            </div>
            <h2 className="mt-4 text-xl font-black text-[#292B43]">
              حماية محتوى المتجر
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#6F7185]">
              {data.blockedMessage}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
