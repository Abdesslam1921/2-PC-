import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Gift,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ThankYouPopup } from "@/components/ThankYouPopup";
import { OrderTrackingBox } from "@/components/OrderTrackingBox";
import { PixelIds, trackPixelEvent } from "@/lib/pixels";

type AlgerianLocation = {
  commune_name: string;
  wilaya_code: string;
  wilaya_name: string;
  latinName?: string;
  wilayaLatinName?: string;
};
type CarrierAccount = {
  id: number;
  accountName: string;
  apiBaseUrl: string | null;
  provider: string;
  catalog?: {
    providerKey: string;
    displayName: string;
    bureauAssetUrl: string;
  } | null;
};
type EcotrackBureau = {
  code: string;
  name: string;
  wilayaLatin: string;
  communeLatin: string;
  phone: string;
};
type UpsellLine = {
  productId: number;
  priceOverride: string;
  title?: string;
  imageUrl?: string;
};
type DirectCodOrderFormProps = {
  productId: number;
  variantId?: number;
  offerId?: number;
  productTitle: string;
  price?: string | null;
  productImageUrl?: string;
  formId?: string;
  accentColor?: string;
  className?: string;
  maxQuantity?: number;
  pixelIds?: PixelIds;
  landingPageId?: number;
  discountPercent?: number;
  upsellLine?: UpsellLine;
  upsellDecisionRequired?: boolean;
  onRequestUpsellDecision?: () => void;
  resumeSubmitToken?: number;
  submitLabel?: string;
  onOrderSuccess?: () => void;
};
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}
const LOCATIONS_URL = "/manus-storage/algeria_cities_ecotrack_6e915ae7.json";
const BUREAUX_URL = "/manus-storage/ecotrack_bureaux_a23a8ab0.json";
const normalizeCode = (value?: string | number | null) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
const money = (price?: string | null) =>
  price
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(price))} دج`
    : "يُؤكد السعر عند الطلب";

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#E3E1D8] bg-white px-3.5 text-sm font-semibold text-[#242E29] outline-none transition duration-200 placeholder:font-medium placeholder:text-[#A7AFA9] focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10";
const labelClass = "text-right text-sm font-extrabold text-[#2E3833]";

const humanInvalid =
  (messages: { valueMissing?: string; patternMismatch?: string }) =>
  (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => {
    const validity = event.currentTarget.validity;
    const message = validity.valueMissing
      ? messages.valueMissing
      : validity.patternMismatch
        ? messages.patternMismatch
        : undefined;
    if (message) event.currentTarget.setCustomValidity(message);
  };
const clearInvalid = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) =>
  event.currentTarget.setCustomValidity("");

export function DirectCodOrderForm({
  productId,
  variantId,
  offerId,
  productTitle,
  price,
  productImageUrl,
  formId = "cod-order-form",
  accentColor = "#0B5B43",
  className = "",
  maxQuantity = 50,
  pixelIds = {},
  landingPageId,
  discountPercent = 0,
  upsellLine,
  upsellDecisionRequired = false,
  onRequestUpsellDecision,
  resumeSubmitToken = 0,
  submitLabel,
  onOrderSuccess,
}: DirectCodOrderFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastResumeToken = useRef(resumeSubmitToken);
  const [urlDiscount] = useState(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("discount");
      const value = Math.floor(Number(raw));
      return Number.isFinite(value) && value > 0 && value <= 90 ? value : 0;
    } catch {
      return 0;
    }
  });
  const discountFromRetarget = urlDiscount > discountPercent;
  const activeDiscountPercent = Math.max(discountPercent, urlDiscount);
  const effectivePrice =
    price && activeDiscountPercent > 0
      ? String(Number(price) * (1 - activeDiscountPercent / 100))
      : price;
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    wilaya: "",
    wilayaCode: "",
    municipality: "",
  });
  const [sessionId] = useState(() => {
    const key = `abdou-abandoned-${productId}`;
    try {
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      const next = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      window.sessionStorage.setItem(key, next);
      return next;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
  });
  const [quantity, setQuantity] = useState(1);
  const [attribution] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      attributionSource: params.get("utm_source")
        ? "utm"
        : params.get("fbclid")
          ? "meta"
          : undefined,
      fbclid: params.get("fbclid") || undefined,
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      utmContent: params.get("utm_content") || undefined,
      utmTerm: params.get("utm_term") || undefined,
      metaCampaignId: params.get("campaign_id") || undefined,
      metaAdSetId: params.get("adset_id") || undefined,
      metaAdId: params.get("ad_id") || undefined,
    };
  });
  const [deliveryMethod, setDeliveryMethod] = useState<"office" | "home">(
    "home"
  );
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | null>(
    null
  );
  const [selectedBureau, setSelectedBureau] = useState("");
  const [bureaux, setBureaux] = useState<EcotrackBureau[]>([]);
  const [locations, setLocations] = useState<AlgerianLocation[]>([]);
  const [locationsError, setLocationsError] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    orderNumber: string;
    total: string;
    customerPhone: string;
    productId: number;
  } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const optionalOrderApi = trpc.orders as unknown as {
    saveAbandoned?: { useMutation: () => { mutate: (input: unknown) => void } };
    markAbandonedConverted?: {
      useMutation: () => { mutate: (input: unknown) => void };
    };
  };
  const saveAbandoned = optionalOrderApi.saveAbandoned?.useMutation() ?? {
    mutate: (_input: unknown) => undefined,
  };
  const markAbandonedConverted =
    optionalOrderApi.markAbandonedConverted?.useMutation() ?? {
      mutate: (_input: unknown) => undefined,
    };
  const optionalConnecteursApi = trpc as unknown as {
    connecteurs?: {
      track?: { useMutation: () => { mutate: (input: unknown) => void } };
      turnstilePublic?: {
        useQuery: (input: { productId: number }) => { data?: string };
      };
    };
  };
  const turnstileSiteKey =
    optionalConnecteursApi.connecteurs?.turnstilePublic?.useQuery({
      productId,
    })?.data;
  const trackServer =
    optionalConnecteursApi.connecteurs?.track?.useMutation() ?? {
      mutate: (_input: unknown) => undefined,
    };
  const createOrder = trpc.orders.createCod.useMutation({
    onSuccess: result => {
      const nextConfirmation = {
        orderNumber: result.orderNumber,
        total: result.total,
        customerPhone: form.customerPhone,
        productId,
      };
      trackPixelEvent(pixelIds, "Purchase", {
        content_ids: [String(productId)],
        value: Number(result.total),
        currency: "DZD",
      });
      (Object.keys(pixelIds) as Array<"meta" | "tiktok" | "snapchat">)
        .filter(key => Boolean(pixelIds[key]))
        .forEach(key =>
          trackServer.mutate({
            productId,
            kind:
              key === "meta"
                ? "meta_capi"
                : key === "tiktok"
                  ? "tiktok_capi"
                  : "snapchat_capi",
            eventName: "Purchase",
            eventId: result.orderNumber,
            value: Number(result.total),
            currency: "DZD",
            contentIds: [String(productId)],
            phone: form.customerPhone,
          })
        );
      markAbandonedConverted.mutate({ productId, sessionId });
      setConfirmed(nextConfirmation);
      onOrderSuccess?.();
    },
  });
  const carrierOptionsApi = (
    trpc as unknown as {
      delivery?: {
        publicCarrierOptions?: {
          useQuery: (input: { productId: number }) => {
            data?: { allowCustomerChoice: boolean; accounts: CarrierAccount[] };
          };
        };
      };
    }
  ).delivery;
  const carrierOptions = carrierOptionsApi?.publicCarrierOptions?.useQuery({
    productId,
  }) ?? {
    data: { allowCustomerChoice: false, accounts: [] as CarrierAccount[] },
  };
  const carrierAccounts = carrierOptions.data?.accounts ?? [];
  const selectedCarrier = carrierAccounts.find(
    account => account.id === selectedCarrierId
  );
  const bureauSourceUrl =
    selectedCarrier?.catalog?.bureauAssetUrl ??
    (carrierAccounts.length === 0 ? BUREAUX_URL : "");
  useEffect(() => {
    if (selectedCarrierId === null && carrierAccounts[0])
      setSelectedCarrierId(carrierAccounts[0].id);
  }, [carrierAccounts, selectedCarrierId]);
  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;
    const mount = () => {
      if (window.turnstile && turnstileRef.current)
        window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: token => {
            setTurnstileToken(token);
            setTurnstileError(false);
          },
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
    };
    if (window.turnstile) mount();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", mount);
      document.head.appendChild(script);
      return () => script.removeEventListener("load", mount);
    }
  }, [turnstileSiteKey]);
  const quoteApi = (
    trpc as unknown as {
      delivery?: {
        quoteForProduct?: {
          useQuery: (
            input: {
              productId: number;
              wilaya: string;
              wilayaCode?: string;
              deliveryMethod: "office" | "home";
            },
            options: { enabled: boolean }
          ) => { data?: { deliveryFee: string; configured?: boolean } };
        };
      };
    }
  ).delivery;
  const quote = quoteApi?.quoteForProduct?.useQuery(
    {
      productId,
      wilaya: form.wilaya || "غير محدد",
      wilayaCode: form.wilayaCode || undefined,
      deliveryMethod,
    },
    { enabled: Boolean(form.wilaya && form.wilayaCode) }
  ) ?? { data: { deliveryFee: "0.00", configured: false } };
  const wilayaCountApi = (
    trpc as unknown as {
      orders?: {
        getTodayWilayaOrderCount?: {
          useQuery: (
            input: { productId: number; wilaya: string },
            options: { enabled: boolean }
          ) => { data?: { count: number } };
        };
      };
    }
  ).orders;
  const wilayaCountQuery = wilayaCountApi?.getTodayWilayaOrderCount?.useQuery(
    { productId, wilaya: form.wilaya },
    { enabled: Boolean(form.wilaya) }
  );
  useEffect(() => {
    trackPixelEvent(pixelIds, "PageView", {
      content_ids: [String(productId)],
      content_name: productTitle,
    });
    (Object.keys(pixelIds) as Array<"meta" | "tiktok" | "snapchat">)
      .filter(key => Boolean(pixelIds[key]))
      .forEach(key =>
        trackServer.mutate({
          productId,
          kind:
            key === "meta"
              ? "meta_capi"
              : key === "tiktok"
                ? "tiktok_capi"
                : "snapchat_capi",
          eventName: "PageView",
          eventId: `${productId}-page-${Date.now()}`,
          contentIds: [String(productId)],
        })
      );
  }, [
    productId,
    productTitle,
    pixelIds.meta,
    pixelIds.tiktok,
    pixelIds.snapchat,
  ]);
  useEffect(() => {
    if (!bureauSourceUrl) {
      setBureaux([]);
      return;
    }
    let active = true;
    fetch(bureauSourceUrl)
      .then(response => (response.ok ? response.json() : Promise.reject()))
      .then((data: EcotrackBureau[]) => {
        if (active) setBureaux(data);
      })
      .catch(() => {
        if (active) setBureaux([]);
      });
    return () => {
      active = false;
    };
  }, [bureauSourceUrl]);
  useEffect(() => {
    let active = true;
    fetch(LOCATIONS_URL)
      .then(response =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("locations unavailable"))
      )
      .then((data: AlgerianLocation[]) => {
        if (active) setLocations(data);
      })
      .catch(() => {
        if (active) setLocationsError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => setQuantity(current => Math.max(1, Math.min(current, maxQuantity))),
    [maxQuantity]
  );
  useEffect(() => {
    if (
      !form.customerName &&
      !form.customerPhone &&
      !form.wilaya &&
      !form.municipality
    )
      return;
    const timer = window.setTimeout(
      () =>
        saveAbandoned.mutate({
          productId,
          sessionId,
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          wilaya: form.wilaya || undefined,
          municipality: form.municipality || undefined,
          quantity,
        }),
      800
    );
    return () => window.clearTimeout(timer);
  }, [
    form.customerName,
    form.customerPhone,
    form.wilaya,
    form.municipality,
    productId,
    quantity,
    sessionId,
  ]);
  const wilayas = useMemo(
    () =>
      Array.from(
        new Map(
          locations.map(location => [
            location.wilaya_code,
            location.wilaya_name,
          ])
        ).entries()
      )
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [locations]
  );
  const municipalities = useMemo(
    () =>
      locations
        .filter(location => location.wilaya_name === form.wilaya)
        .sort((a, b) => a.commune_name.localeCompare(b.commune_name, "ar")),
    [locations, form.wilaya]
  );
  const availableBureaux = useMemo(
    () =>
      bureaux.filter(
        bureau => normalizeCode(bureau.code) === normalizeCode(form.wilayaCode)
      ),
    [bureaux, form.wilayaCode]
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === "wilaya" ? { municipality: "" } : {}),
    }));
  const updateWilaya = (value: string) => {
    const selected = wilayas.find(item => item.name === value);
    setSelectedBureau("");
    setForm(current => ({
      ...current,
      wilaya: value,
      wilayaCode: selected?.code ?? "",
      municipality: "",
    }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (upsellDecisionRequired) {
      onRequestUpsellDecision?.();
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setTurnstileError(true);
      return;
    }
    const selectedMunicipality = municipalities.find(
      item => item.commune_name === form.municipality
    );
    const selectedOffice = availableBureaux.find(
      item => item.communeLatin === selectedBureau
    );
    if (deliveryMethod === "office" && !selectedOffice) return;
    trackPixelEvent(pixelIds, "Lead", {
      content_ids: [String(productId)],
      value: effectivePrice ? Number(effectivePrice) * quantity : undefined,
      currency: "DZD",
    });
    (Object.keys(pixelIds) as Array<"meta" | "tiktok" | "snapchat">)
      .filter(key => Boolean(pixelIds[key]))
      .forEach(key =>
        trackServer.mutate({
          productId,
          kind:
            key === "meta"
              ? "meta_capi"
              : key === "tiktok"
                ? "tiktok_capi"
                : "snapchat_capi",
          eventName: "Lead",
          eventId: `${productId}-lead-${sessionId}`,
          value: price ? Number(price) * quantity : undefined,
          contentIds: [String(productId)],
          phone: form.customerPhone,
        })
      );
    createOrder.mutate({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      wilaya: form.wilaya,
      wilayaCode: form.wilayaCode || undefined,
      municipality:
        deliveryMethod === "office" ? selectedOffice?.name : form.municipality,
      carrierMunicipality:
        deliveryMethod === "office"
          ? selectedOffice?.communeLatin
          : selectedMunicipality?.latinName || undefined,
      carrierConnectionId: selectedCarrierId ?? undefined,
      deliveryMethod,
      address:
        deliveryMethod === "office"
          ? selectedOffice?.name || form.municipality
          : form.municipality,
      notes:
        deliveryMethod === "office"
          ? `المكتب: ${selectedOffice?.name}`
          : `البلدية: ${form.municipality}`,
      sessionId,
      landingPageId,
      sharkCodDiscountPercent:
        !discountFromRetarget && discountPercent > 0
          ? discountPercent
          : undefined,
      retargetDiscountPercent: discountFromRetarget ? urlDiscount : undefined,
      turnstileToken: turnstileToken || undefined,
      ...attribution,
      lines: [
        { productId, variantId, ...(offerId ? { offerId } : {}), quantity },
        ...(upsellLine
          ? [
              {
                productId: upsellLine.productId,
                priceOverride: upsellLine.priceOverride,
                quantity: 1,
              },
            ]
          : []),
      ],
    });
  };
  useEffect(() => {
    if (resumeSubmitToken !== lastResumeToken.current) {
      lastResumeToken.current = resumeSubmitToken;
      formRef.current?.requestSubmit();
    }
  }, [resumeSubmitToken]);
  if (confirmed)
    return (
      <section
        id={formId}
        dir="rtl"
        className={`scroll-mt-24 rounded-[28px] border border-[#CBE5D6] bg-white p-6 text-center shadow-lift sm:p-8 ${className}`}
      >
        <div className="animate-check-pop mx-auto grid size-16 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <CheckCircle2 className="size-9" />
        </div>
        <p className="mt-5 text-sm font-extrabold text-[var(--brand)]">
          تم تسجيل طلبك بنجاح
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.02em] text-[var(--ink)]">
          شكرًا لثقتك في عبدو ستور
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#66716B]">
          سنتصل بك قريبًا على رقمك لتأكيد الطلب. الدفع نقدًا عند الاستلام — لا
          تحتاج أي بطاقة.
        </p>
        <div className="mt-6 rounded-2xl border border-[#E3EDE7] bg-[var(--brand-soft)] p-4">
          <p className="text-xs font-bold text-[#5F7A6D]">رقم الطلب</p>
          <p className="mt-1 text-xl font-extrabold tracking-wide text-[var(--brand-strong)]">
            {confirmed.orderNumber}
          </p>
          <p className="mt-1.5 text-sm font-extrabold text-[#2E3833]">
            الإجمالي: {money(confirmed.total)}
          </p>
        </div>
        <OrderTrackingBox
          productId={confirmed.productId}
          orderNumber={confirmed.orderNumber}
        />
        <ThankYouPopup
          productId={confirmed.productId}
          orderNumber={confirmed.orderNumber}
          total={confirmed.total}
          onClose={() => setConfirmed(null)}
        />
      </section>
    );

  const deliveryFee = quote.data?.deliveryFee ?? "0.00";
  const mainTotal = effectivePrice ? Number(effectivePrice) * quantity : 0;
  const upsellTotal = upsellLine ? Number(upsellLine.priceOverride) * 1 : 0;
  const totalWithDelivery = effectivePrice
    ? String(mainTotal + upsellTotal + Number(deliveryFee))
    : null;
  return (
    <section
      id={formId}
      dir="rtl"
      className={`scroll-mt-24 overflow-hidden rounded-[28px] border border-[#E7E5DC] bg-white shadow-lift ${className}`}
    >
      <div className="border-b border-[#EFEDE5] bg-[linear-gradient(135deg,var(--brand-soft),#FBF6EC)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow-soft"
            style={{ color: accentColor }}
          >
            {productImageUrl ? (
              <img
                src={productImageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <CircleDollarSign className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-extrabold text-white">
              <Banknote className="size-3" />
              الدفع عند الاستلام
            </span>
            <h2 className="mt-2 text-xl font-extrabold tracking-[-.02em] text-[var(--ink)]">
              اطلب {productTitle} الآن
            </h2>
            <p className="mt-1 text-sm font-extrabold text-[#2E3833]">
              {money(effectivePrice)}
              {activeDiscountPercent > 0 && (
                <span className="mr-2 rounded-full bg-[#FCE8E4] px-2 py-0.5 text-[11px] font-extrabold text-[#C0492F]">
                  خصم {activeDiscountPercent}%
                </span>
              )}
            </p>
          </div>
          {upsellLine && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E3EDE7] bg-[var(--warm-soft)] px-3 py-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--warm-soft)] text-[var(--warm)]">
                <Gift className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#3F3A32]">
                  {upsellLine.title ?? "منتج إضافي"}
                </p>
                <p className="mt-0.5 text-xs font-bold text-[#8A7B66]">
                  مُضاف إلى طلبك
                </p>
              </div>
              <div className="shrink-0 text-xs font-extrabold text-[var(--warm)]">
                {upsellLine.priceOverride
                  ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(upsellLine.priceOverride))} دج`
                  : "—"}
              </div>
            </div>
          )}
        </div>
      </div>
      <form ref={formRef} onSubmit={submit} className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <UserRound className="size-4" style={{ color: accentColor }} />
              الاسم الكامل
            </span>
            <input
              required
              value={form.customerName}
              onInvalid={humanInvalid({
                valueMissing: "اكتب اسمك الكامل حتى نؤكد طلبك.",
              })}
              onChange={event => {
                clearInvalid(event);
                update("customerName", event.target.value);
              }}
              placeholder="الاسم واللقب"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Phone className="size-4" style={{ color: accentColor }} />
              رقم الهاتف
            </span>
            <input
              required
              inputMode="tel"
              pattern="0[567][0-9]{8}"
              minLength={10}
              maxLength={10}
              value={form.customerPhone}
              onInvalid={humanInvalid({
                valueMissing:
                  "أدخل رقم هاتفك — نحتاجه للاتصال بك وتأكيد الطلب.",
                patternMismatch:
                  "رقم الهاتف يجب أن يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام.",
              })}
              onChange={event => {
                clearInvalid(event);
                update(
                  "customerPhone",
                  event.target.value.replace(/\D/g, "").slice(0, 10)
                );
              }}
              placeholder="05xxxxxxxx"
              className={fieldClass}
            />
          </label>
          <label className={`relative ${labelClass}`}>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" style={{ color: accentColor }} />
              الولاية
            </span>
            <select
              aria-label="الولاية"
              required
              value={form.wilaya}
              onInvalid={humanInvalid({
                valueMissing: "اختر ولايتك من القائمة حتى نحسب رسوم التوصيل.",
              })}
              onChange={event => {
                clearInvalid(event);
                updateWilaya(event.target.value);
              }}
              disabled={!wilayas.length}
              className={`${fieldClass} appearance-none disabled:cursor-wait`}
            >
              <option value="">
                {locationsError ? "تعذر تحميل الولايات" : "اختر الولاية"}
              </option>
              {wilayas.map(wilaya => (
                <option key={wilaya.code} value={wilaya.name}>
                  {wilaya.code} · {wilaya.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-[#8A938D]" />
            {form.wilaya &&
              wilayaCountQuery?.data?.count !== undefined &&
              wilayaCountQuery.data.count > 0 && (
                <p className="mt-2 text-xs font-bold text-[var(--brand-strong)]">
                  🛡️ {wilayaCountQuery.data.count} أشخاص من {form.wilaya} طلبوا هذا المنتج اليوم
                </p>
              )}
          </label>
          <label className={`relative ${labelClass}`}>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" style={{ color: accentColor }} />
              البلدية
            </span>
            <select
              aria-label="البلدية"
              required
              value={form.municipality}
              onInvalid={humanInvalid({
                valueMissing: "اختر بلديتك حتى يصل طلبك للمكان الصحيح.",
              })}
              onChange={event => {
                clearInvalid(event);
                update("municipality", event.target.value);
              }}
              disabled={!form.wilaya || !municipalities.length}
              className={`${fieldClass} appearance-none disabled:cursor-not-allowed disabled:bg-[#F6F5F0]`}
            >
              <option value="">
                {form.wilaya ? "اختر البلدية" : "اختر الولاية أولًا"}
              </option>
              {municipalities.map(municipality => (
                <option
                  key={`${municipality.wilaya_code}-${municipality.commune_name}`}
                  value={municipality.commune_name}
                >
                  {municipality.commune_name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-[#8A938D]" />
          </label>
        </div>
        {carrierOptions.data?.allowCustomerChoice &&
          carrierAccounts.length > 1 && (
            <label className={`mt-5 block ${labelClass}`}>
              شركة التوصيل
              <select
                aria-label="شركة التوصيل"
                required
                value={selectedCarrierId ?? ""}
                onInvalid={humanInvalid({
                  valueMissing: "اختر شركة التوصيل التي تفضلها.",
                })}
                onChange={event => {
                  clearInvalid(event);
                  setSelectedCarrierId(Number(event.target.value));
                  setSelectedBureau("");
                }}
                className={fieldClass}
              >
                <option value="" disabled>
                  اختر شركة التوصيل
                </option>
                {carrierAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </label>
          )}
        <fieldset className="mt-5">
          <legend className="mb-2.5 text-sm font-extrabold text-[#2E3833]">
            طريقة التوصيل
          </legend>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E7E5DC] bg-[#F6F5F0] p-1.5">
            <button
              type="button"
              onClick={() => setDeliveryMethod("home")}
              className={`btn-press flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold ${deliveryMethod === "home" ? "bg-white text-[var(--brand)] shadow-soft" : "text-[#79837D] hover:text-[#4A554F]"}`}
            >
              <Truck className="size-4" />
              إلى المنزل
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod("office")}
              className={`btn-press flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold ${deliveryMethod === "office" ? "bg-white text-[var(--brand)] shadow-soft" : "text-[#79837D] hover:text-[#4A554F]"}`}
            >
              <MapPin className="size-4" />
              إلى المكتب
            </button>
          </div>
        </fieldset>
        {deliveryMethod === "office" && (
          <label className={`mt-5 block ${labelClass}`}>
            مكتب التوصيل
            <select
              aria-label="مكتب التوصيل"
              required
              value={selectedBureau}
              onInvalid={humanInvalid({
                valueMissing: "اختر المكتب الأقرب إليك لاستلام طلبك.",
              })}
              onChange={event => {
                clearInvalid(event);
                setSelectedBureau(event.target.value);
              }}
              disabled={!form.wilayaCode || !availableBureaux.length}
              className={`${fieldClass} disabled:bg-[#F6F5F0]`}
            >
              <option value="">
                {availableBureaux.length
                  ? "اختر المكتب"
                  : "لا توجد مكاتب معرفة لهذه الولاية"}
              </option>
              {availableBureaux.map(bureau => (
                <option
                  key={`${bureau.code}-${bureau.name}`}
                  value={bureau.communeLatin}
                >
                  {bureau.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-5 rounded-2xl border border-[#E3EDE7] bg-[var(--brand-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[#2E3833]">الكمية</p>
              <p className="mt-1 text-xs text-[#66716B]">
                الحد المتاح: {maxQuantity} قطعة
              </p>
            </div>
            <div className="flex h-11 items-center rounded-xl border border-[#CBE0D3] bg-white shadow-soft">
              <button
                type="button"
                aria-label="تقليل الكمية"
                onClick={() => setQuantity(current => Math.max(1, current - 1))}
                className="grid size-11 place-items-center text-[var(--brand)] transition hover:bg-[var(--brand-soft)]"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-9 text-center text-sm font-extrabold text-[var(--ink)]">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="زيادة الكمية"
                disabled={quantity >= maxQuantity}
                onClick={() =>
                  setQuantity(current => Math.min(maxQuantity, current + 1))
                }
                className="grid size-11 place-items-center text-[var(--brand)] transition hover:bg-[var(--brand-soft)] disabled:opacity-35"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-3.5 space-y-1.5 border-t border-[#D6E5DC] pt-3.5 text-sm font-bold text-[#4A554F]">
            <p className="flex items-center justify-between">
              <span>رسوم التوصيل</span>
              <span>{form.wilaya ? money(deliveryFee) : "اختر الولاية"}</span>
            </p>
            <p className="flex items-center justify-between text-base font-extrabold text-[var(--brand-strong)]">
              <span>الإجمالي</span>
              <span>
                {totalWithDelivery
                  ? money(totalWithDelivery)
                  : "يُؤكد عند الطلب"}
              </span>
            </p>
          </div>
        </div>
        {turnstileSiteKey && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <div ref={turnstileRef} />
            <p className="text-xs font-bold text-[#8A938D]">
              تحقق أمني لحماية الطلب من الروبوتات
            </p>
            {turnstileError && (
              <p className="flex items-center gap-1.5 rounded-full bg-[#FCE8E4] px-3 py-1.5 text-xs font-extrabold text-[#C0492F]">
                <AlertCircle className="size-3.5" />
                أكمل التحقق الأمني أولًا حتى نتأكد أنك لست روبوتًا.
              </p>
            )}
          </div>
        )}
        {createOrder.error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#F3D2CB] bg-[#FCE8E4] px-4 py-3 text-sm font-bold leading-6 text-[#A63D28]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {createOrder.error.message}
          </div>
        )}
        <button
          disabled={createOrder.isPending || !wilayas.length}
          type="submit"
          className="btn-press animate-cta-pulse mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-55 disabled:[animation:none]"
          style={{ backgroundColor: accentColor }}
        >
          {createOrder.isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              جارٍ تسجيل الطلب…
            </>
          ) : (
            <>
              <Banknote className="size-5" />
              {submitLabel || "تأكيد الطلب والدفع عند الاستلام"}
            </>
          )}
        </button>
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] font-bold text-[#79837D]">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-[var(--brand)]" />
            لا تحتاج بطاقة بنكية
          </span>
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3.5 text-[var(--brand)]" />
            تأكيد هاتفي قبل الإرسال
          </span>
          <span className="inline-flex items-center gap-1">
            <Truck className="size-3.5 text-[var(--brand)]" />
            توصيل لـ 58 ولاية
          </span>
        </div>
      </form>
    </section>
  );
}

export function StickyCodCta({
  targetId = "cod-order-form",
  label = "اطلب الآن · الدفع عند الاستلام",
  accentColor = "#0B5B43",
  onClick,
}: {
  targetId?: string;
  label?: string;
  accentColor?: string;
  onClick?: () => void;
}) {
  const scrollToForm = () =>
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const handleClick = onClick ?? scrollToForm;
  return (
    <button
      type="button"
      onClick={handleClick}
      className="btn-press animate-cta-pulse fixed inset-x-4 bottom-4 z-50 mx-auto flex h-14 max-w-md items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold text-white"
      style={{ backgroundColor: accentColor }}
    >
      <Banknote className="size-5" />
      {label}
    </button>
  );
}
