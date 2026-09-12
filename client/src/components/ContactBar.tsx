import { MessageCircle, Phone, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Surface = "store" | "product" | "landing";
type ContactBarProps = { productId?: number; surface: Surface };
type ContactBarSettings = {
  enabled: boolean;
  phoneEnabled: boolean;
  phoneNumber: string;
  phoneSticky: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappSticky: boolean;
  showOnStore: boolean;
  showOnProduct: boolean;
  showOnLanding: boolean;
};

export function normalizeContactNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) return `213${digits.slice(1)}`;
  return digits;
}

function isSurfaceEnabled(settings: ContactBarSettings, surface: Surface) {
  return surface === "store"
    ? settings.showOnStore
    : surface === "product"
      ? settings.showOnProduct
      : settings.showOnLanding;
}

export function ContactBar({ productId, surface }: ContactBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const contactBarApi = (
    trpc as unknown as {
      contactBar?: {
        publicForProduct?: {
          useQuery: (
            input: { productId: number },
            options?: { enabled?: boolean }
          ) => { data?: unknown };
        };
      };
    }
  ).contactBar;
  const settingsQuery = contactBarApi?.publicForProduct?.useQuery(
    { productId: productId ?? 1 },
    { enabled: Boolean(productId) }
  );
  const settings = settingsQuery?.data as ContactBarSettings | undefined;
  if (
    !productId ||
    !settings ||
    !settings.enabled ||
    !isSurfaceEnabled(settings, surface) ||
    dismissed
  )
    return null;

  const phone = normalizeContactNumber(settings.phoneNumber);
  const whatsapp = normalizeContactNumber(settings.whatsappNumber);
  const showPhone = settings.phoneEnabled && phone.length >= 9;
  const showWhatsapp = settings.whatsappEnabled && whatsapp.length >= 9;
  if (!showPhone && !showWhatsapp) return null;
  const isSticky =
    (showPhone && settings.phoneSticky) ||
    (showWhatsapp && settings.whatsappSticky);
  const wrapperClass = isSticky
    ? "fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md sm:inset-x-auto sm:right-5 sm:max-w-none"
    : "relative z-10 mx-auto mt-6 max-w-md";

  return (
    <div
      dir="rtl"
      className={`${wrapperClass} animate-in fade-in slide-in-from-bottom-2 duration-200`}
      role="region"
      aria-label="طرق التواصل"
    >
      <div className="relative flex items-center gap-2 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_18px_42px_rgba(25,32,46,.18)] backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 gap-2">
          {showPhone && (
            <a
              href={`tel:+${phone}`}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-strong)] px-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#063528] active:scale-[.98]"
              aria-label="الاتصال بالمتجر"
            >
              <Phone className="size-4" />
              اتصال
            </a>
          )}
          {showWhatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#19A463] px-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#12824E] active:scale-[.98]"
              aria-label="التواصل عبر WhatsApp"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[#8B909B] transition hover:bg-[#F2F3F5] hover:text-[#363D49]"
          aria-label="إخفاء شريط الاتصال"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
