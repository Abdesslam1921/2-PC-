import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { Gift, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Props = {
  productId: number;
  landingPageId?: number;
  onApplyDiscount: (percent: number) => void;
  onInteract?: () => void;
};

export type SharkCodExitPopupHandle = {
  deactivate: () => void;
};

const REJECTION_REASONS = [
  { value: "reject_price", label: "السعر غالي" },
  { value: "reject_delivery", label: "التوصيل غالي" },
  { value: "reject_compare", label: "حبيت نقارن" },
  { value: "reject_hesitate", label: "مازلت متردد" },
  { value: "reject_payment", label: "ما لقيتش طريقة الدفع المناسبة" },
  { value: "reject_changed_mind", label: "غيرت رأيي" },
] as const;

export const SharkCodExitPopup = forwardRef<
  SharkCodExitPopupHandle,
  Props
>(function SharkCodExitPopup(
  { productId, landingPageId, onApplyDiscount, onInteract },
  ref
) {
  const optionalSharkApi = (
    trpc as unknown as {
      sharkCod?: {
        publicSettings?: {
          useQuery: (input: {
            productId: number;
            landingPageId?: number;
          }) => {
            data?: {
              id: number;
              ownerId: number;
              enabled: boolean;
              title: string;
              descriptionBefore: string;
              descriptionAfter: string;
              buttonText: string;
              discountPercent: number;
              targetMode: "all" | "product" | "landing";
              targetProductId: number | null;
              targetLandingPageId: number | null;
            };
          };
        };
        track?: {
          useMutation: () => { mutate: (input: unknown) => void };
        };
      };
    }
  ).sharkCod;
  const settingsQuery = optionalSharkApi?.publicSettings?.useQuery({
    productId,
    landingPageId,
  }) ?? { data: undefined };
  const track =
    optionalSharkApi?.track?.useMutation() ?? {
      mutate: (_input: unknown) => undefined,
    };

  const [visible, setVisible] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [alive, setAlive] = useState(true);
  const shown = useRef(false);
  const exitBlocked = useRef(false);
  const interacted = useRef(false);
  const deactivated = useRef(false);
  const [sessionId] = useState(
    () => `shark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  const settings = settingsQuery.data;

  useImperativeHandle(ref, () => ({
    deactivate: () => {
      deactivated.current = true;
      shown.current = true;
      exitBlocked.current = false;
      interacted.current = false;
      history.replaceState(null, "", location.href);
      setVisible(false);
      setShowSurvey(false);
      setAlive(false);
    },
  }));

  const show = () => {
    if (!settings || shown.current || deactivated.current) return;
    shown.current = true;
    setVisible(true);
    track.mutate({ productId, landingPageId, eventType: "view", sessionId });
  };

  const resetAndNavigateBack = () => {
    exitBlocked.current = false;
    interacted.current = false;
    history.back();
  };

  const handleAccept = () => {
    if (!settings) return;
    interacted.current = true;
    track.mutate({
      productId,
      landingPageId,
      eventType: "cta_click",
      sessionId,
    });
    onApplyDiscount(settings.discountPercent);
    setVisible(false);
    onInteract?.();
    if (exitBlocked.current) {
      resetAndNavigateBack();
    }
  };

  const handleReject = () => {
    interacted.current = true;
    setVisible(false);
    setShowSurvey(true);
    onInteract?.();
    if (exitBlocked.current) {
      resetAndNavigateBack();
    }
  };

  const handleSurveySubmit = (reason: string) => {
    track.mutate({
      productId,
      landingPageId,
      eventType: reason as
        | "reject_price"
        | "reject_delivery"
        | "reject_compare"
        | "reject_hesitate"
        | "reject_payment"
        | "reject_changed_mind",
      sessionId,
    });
    setShowSurvey(false);
    onInteract?.();
    if (exitBlocked.current) {
      resetAndNavigateBack();
    }
  };

  useEffect(() => {
    if (!settings || deactivated.current) return;

    history.pushState({ sharkExit: true }, "", location.href);

    const onPopState = (event: PopStateEvent) => {
      if (deactivated.current) return;
      const hasMarker = event.state && event.state.sharkExit === true;

      if (hasMarker) {
        if (interacted.current) {
          interacted.current = false;
          return;
        }
        if (!shown.current) show();
        exitBlocked.current = true;
        history.pushState({ sharkExit: true }, "", location.href);
        return;
      }

      if (!shown.current) show();
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shown.current || deactivated.current) return;
      show();
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;
      if (anchor.hasAttribute("download")) return;
      const origin = anchor.ownerDocument?.location?.origin ?? "";
      if (href.startsWith(origin)) return;
      if (!shown.current && !deactivated.current) show();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [settings, alive]);

  if (!alive || deactivated.current) return null;
  if (!visible && !showSurvey) return null;

  return (
    <>
      {visible && settings && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0E1B15]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={settings.title}
          dir="rtl"
        >
          <div className="animate-check-pop relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white p-7 text-center shadow-lift">
            <button
              type="button"
              onClick={handleReject}
              aria-label="إغلاق"
              className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-[#F2F1EB] text-[#79837D] transition:hover:bg-[#E7E5DC] active:scale-95"
            >
              <X className="size-4" />
            </button>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
              <Gift className="size-7" />
            </div>
            <h2 className="mt-5 text-2xl font-black text-[var(--ink)]">
              {settings.title}
            </h2>
            <p className="mt-3 text-base font-bold leading-8 text-[#4A554F]">
              {settings.descriptionBefore}
            </p>
            <p className="mt-2 text-5xl font-black tracking-tight text-[var(--warm)]">
              {settings.discountPercent}%
            </p>
            <p className="mt-2 text-sm leading-7 text-[#66716B]">
              {settings.descriptionAfter}
            </p>
            <button
              type="button"
              onClick={handleAccept}
              className="btn-press animate-cta-pulse mt-6 flex w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 py-4 text-base font-black text-white"
            >
              {settings.buttonText}
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="mt-3 text-xs font-bold text-[#8A938D] underline underline-offset-4"
            >
              لا، شكرًا
            </button>
          </div>
        </div>
      )}

      {showSurvey && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[#0E1B15]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="لماذا تريد المغادرة؟"
          dir="rtl"
        >
          <div className="animate-check-pop w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white p-7 shadow-lift">
            <h2 className="text-center text-xl font-black text-[var(--ink)]">
              وش خلاك ما تكملش؟
            </h2>
            <p className="mt-2 text-center text-xs text-[#8A938D]">
              اختر السبب الأقرب — هذا يساعدنا في تحسين التجربة للجميع.
            </p>
            <div className="mt-5 space-y-2.5">
              {REJECTION_REASONS.map(reason => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => handleSurveySubmit(reason.value)}
                  className="btn-press flex w-full items-center gap-3 rounded-2xl border border-[#E7E9E2] bg-white px-4 py-3 text-right text-sm font-extrabold text-[#4A554F] shadow-soft transition:hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                    <span className="text-[10px] font-black">🔘</span>
                  </span>
                  {reason.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] leading-6 text-[#9AA49E]">
              🔥 بعدها المنصة تتعلم من آلاف العملاء. بعد شهر، التاجر يكتشف: 42%
              من abandonment سببه delivery price.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSurvey(false);
                setVisible(false);
                onInteract?.();
              }}
              className="mt-3 block w-full text-center text-xs font-bold text-[#8A938D] underline underline-offset-4"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
});
