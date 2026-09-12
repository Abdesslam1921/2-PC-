import {
  Banknote,
  Gift,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

type UpsellProduct = {
  id: number;
  title: string;
  price: string | null;
  compareAtPrice?: string | null;
  description?: string | null;
  images: Array<{ id: number; url: string; altText?: string | null }>;
};

type CheckoutUpsellPopupProps = {
  product: UpsellProduct | null;
  upsellPrice?: string | null;
  upsellDiscountAmount?: string | null;
  upsellDiscountPercent?: number | null;
  currency?: string;
  viewType?: "product" | "landing";
  landingPageId?: number | null;
  onAccept: () => void;
  onDecline: () => void;
};

const arDzd = (currency = "DZD") =>
  currency === "EUR" ? "€" : currency === "USD" ? "$" : "دج";

function formatPrice(value: string | null | undefined, currency = "DZD") {
  if (!value) return null;
  return `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} ${arDzd(currency)}`;
}

function parseBullets(raw: string) {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

type DesignSystem = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

function parseDesignSystem(raw: string | null): DesignSystem {
  try {
    const value = JSON.parse(raw ?? "{}") as Partial<DesignSystem>;
    return {
      primaryColor: value.primaryColor ?? "var(--brand)",
      secondaryColor: value.secondaryColor ?? "#182420",
      accentColor: value.accentColor ?? "#E7C671",
    };
  } catch {
    return {
      primaryColor: "var(--brand)",
      secondaryColor: "#182420",
      accentColor: "#E7C671",
    };
  }
}

export type UpsellOffer = {
  mode: "fixed_price" | "discount_amount" | "discount_percent";
  priceOverride: string;
  label: string;
  subtitle: string;
  compareAt: string | null;
  savings: string | null;
};

export function useUpsellOffer(
  product: UpsellProduct | null,
  upsellPrice?: string | null,
  upsellDiscountAmount?: string | null,
  upsellDiscountPercent?: number | null
): UpsellOffer | null {
  return useMemo(() => {
    if (!product) return null;
    const basePrice = product.price ?? "0.00";

    if (upsellPrice) {
      const savings = Number(basePrice) - Number(upsellPrice);
      return {
        mode: "fixed_price",
        priceOverride: upsellPrice,
        label: `أضف هذا المنتج بـ ${formatPrice(upsellPrice)} فقط`,
        subtitle: savings > 0 ? `وفر ${formatPrice(String(savings))}` : "",
        compareAt: Number(basePrice) > Number(upsellPrice) ? basePrice : null,
        savings: savings > 0 ? String(savings) : null,
      };
    }

    if (upsellDiscountAmount) {
      const finalPrice = Math.max(
        0,
        Number(basePrice) - Number(upsellDiscountAmount)
      );
      return {
        mode: "discount_amount",
        priceOverride: String(finalPrice.toFixed(2)),
        label: `وفر ${formatPrice(upsellDiscountAmount)} على هذا المنتج`,
        subtitle: `السعر الخاص: ${formatPrice(String(finalPrice.toFixed(2)))}`,
        compareAt: Number(basePrice) > finalPrice ? basePrice : null,
        savings: Number(upsellDiscountAmount) > 0 ? upsellDiscountAmount : null,
      };
    }

    if (upsellDiscountPercent && upsellDiscountPercent > 0) {
      const finalPrice = Number(basePrice) * (1 - upsellDiscountPercent / 100);
      return {
        mode: "discount_percent",
        priceOverride: String(finalPrice.toFixed(2)),
        label: `خصم ${upsellDiscountPercent}% على هذا المنتج`,
        subtitle: `السعر الخاص: ${formatPrice(String(finalPrice.toFixed(2)))}`,
        compareAt: Number(basePrice) > finalPrice ? basePrice : null,
        savings: String(
          ((Number(basePrice) * upsellDiscountPercent) / 100).toFixed(2)
        ),
      };
    }

    return null;
  }, [product, upsellPrice, upsellDiscountAmount, upsellDiscountPercent]);
}

export function CheckoutUpsellPopup({
  product,
  upsellPrice,
  upsellDiscountAmount,
  upsellDiscountPercent,
  currency = "DZD",
  viewType = "product",
  landingPageId,
  onAccept,
  onDecline,
}: CheckoutUpsellPopupProps) {
  const showLandingPreview = viewType === "landing" && Boolean(landingPageId);
  const landingQuery = trpc.landings.publicRead.useQuery(
    { id: landingPageId ?? 0 },
    { enabled: Boolean(showLandingPreview) }
  );
  const offer = useUpsellOffer(
    product,
    upsellPrice,
    upsellDiscountAmount,
    upsellDiscountPercent
  );
  if (!product || !offer) return null;

  const imageUrl = product.images[0]?.url;
  const showSavings = Boolean(offer.savings);
  const landing = landingQuery.data;
  const landingSections = landing?.sections ?? [];
  const landingAssets = landing?.assets ?? [];
  const sectionScenes = new Map(
    (
      landingAssets as Array<{
        landingSectionId: number | null;
        kind: string;
        sourceUrl: string;
      }>
    )
      .filter(asset => asset.kind === "composition" && asset.landingSectionId)
      .map(asset => [asset.landingSectionId, asset.sourceUrl])
  );
  const originalLandingImage =
    (landingAssets as Array<{ kind: string; sourceUrl: string }>).find(
      asset => asset.kind === "original_product"
    )?.sourceUrl ??
    landingSections[0]?.productImageUrl ??
    imageUrl;
  const design = parseDesignSystem(landing?.designSystemJson ?? null);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[#0E1B15]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="عرض إضافي قبل تأكيد الطلب"
      dir="rtl"
    >
      <div className="animate-check-pop relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-lift">
        <button
          type="button"
          onClick={onDecline}
          aria-label="إغلاق"
          className="absolute left-4 top-4 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#79837D] shadow-sm transition hover:bg-white active:scale-95"
        >
          <X className="size-4" />
        </button>

        <div className="border-b border-[#EFEDE5] bg-[linear-gradient(135deg,var(--brand-soft),#FBF6EC)] p-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <Gift className="size-6" />
          </div>
          <p className="mt-3 text-xs font-extrabold tracking-[.1em] text-[var(--warm)]">
            ⏳ قبل تأكيد طلبك…
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {showLandingPreview && landingQuery.isLoading && (
            <div className="grid min-h-40 place-items-center">
              <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
            </div>
          )}
          {showLandingPreview && !landingQuery.isLoading && landing && (
            <div className="overflow-hidden rounded-2xl border border-[#E7E5DC] shadow-soft">
              <main dir="rtl" className="max-h-[44vh] overflow-y-auto">
                {landingSections.map(section => {
                  const scene = sectionScenes.get(section.id);
                  const bullets = parseBullets(section.bulletsJson);
                  const fallback = !scene && originalLandingImage;
                  return (
                    <section
                      key={section.id}
                      className="relative isolate min-h-[300px] overflow-hidden"
                      style={{
                        background: `linear-gradient(145deg, ${design.secondaryColor}, ${design.primaryColor})`,
                      }}
                    >
                      {scene ? (
                        <img
                          src={scene}
                          alt={landing.title}
                          className="absolute inset-0 -z-10 size-full object-cover"
                        />
                      ) : fallback ? (
                        <img
                          src={fallback}
                          alt={landing.title}
                          className="absolute inset-0 -z-10 size-full object-contain p-8 opacity-90"
                        />
                      ) : null}
                      <div className="absolute inset-x-0 top-0 -z-10 h-[48%] bg-gradient-to-b from-black/80 via-black/48 to-transparent" />
                      <div className="absolute inset-x-4 top-4 z-10 max-w-[85%] rounded-2xl border border-white/15 bg-black/24 p-4 text-right shadow-[0_12px_30px_rgba(0,0,0,.18)] backdrop-blur-[2px]">
                        <p
                          className="text-[10px] font-extrabold tracking-[.13em]"
                          style={{ color: design.accentColor }}
                        >
                          {section.eyebrow ?? section.aidaStage.toUpperCase()}
                        </p>
                        <h2 className="mt-2 text-xl font-extrabold leading-[1.3] text-white">
                          {section.headline}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-white/90">
                          {section.body}
                        </p>
                        {bullets.length > 0 && (
                          <ul className="mt-3 space-y-1.5 text-right text-xs font-bold text-white/95">
                            {bullets.slice(0, 3).map((bullet, bulletIndex) => (
                              <li
                                key={bulletIndex}
                                className="flex items-start gap-2"
                              >
                                <Star
                                  className="mt-0.5 size-3.5 shrink-0"
                                  style={{ color: design.accentColor }}
                                />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                        {section.ctaLabel && (
                          <span className="btn-press mt-4 inline-block rounded-xl px-4 py-2.5 text-xs font-extrabold text-[#21160E] shadow-lg">
                            {section.ctaLabel}
                          </span>
                        )}
                      </div>
                    </section>
                  );
                })}
              </main>
            </div>
          )}

          {!showLandingPreview && (
            <div className="overflow-hidden rounded-2xl border border-[#E7E5DC] shadow-soft">
              {imageUrl ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F2F1EB]">
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="size-full object-cover"
                  />
                  {showSavings && (
                    <span className="absolute right-3 top-3 rounded-full bg-[var(--warm)] px-3 py-1.5 text-xs font-black text-white shadow-lg">
                      وفّر {formatPrice(offer.savings, currency)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center bg-[#F2F1EB]">
                  <ShoppingBag className="size-12 text-[#9FB3A8]" />
                </div>
              )}

              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-[#F0EEE6] bg-[#FAF9F5] px-4 py-3">
                  {product.images.slice(1, 6).map(image => (
                    <img
                      key={image.id}
                      src={image.url}
                      alt={product.title}
                      className="h-16 w-16 shrink-0 rounded-xl border border-[#E7E5DC] object-cover"
                    />
                  ))}
                </div>
              )}

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[var(--brand)]">
                      منتج إضافي بخصم خاص
                    </p>
                    <h2 className="mt-1 text-lg font-extrabold leading-7 text-[var(--ink)]">
                      {product.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      {offer.compareAt && (
                        <span className="text-sm text-[#9AA49E] line-through">
                          {formatPrice(offer.compareAt, currency)}
                        </span>
                      )}
                      <span className="text-2xl font-black text-[var(--brand-strong)]">
                        {formatPrice(offer.priceOverride, currency)}
                      </span>
                      {showSavings && (
                        <span className="rounded-full bg-[var(--warm-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--warm)]">
                          خصم {formatPrice(offer.savings, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#CBE5D6] bg-[var(--brand-soft)] p-3.5 text-center">
                  <p className="text-sm font-extrabold text-[var(--brand-strong)]">
                    {offer.label}
                  </p>
                  {offer.subtitle && (
                    <p className="mt-1 text-xs leading-5 text-[#5F7A6D]">
                      {offer.subtitle}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Banknote, label: "الدفع عند الاستلام" },
                    { icon: Truck, label: "توصيل لـ 58 ولاية" },
                    { icon: ShieldCheck, label: "ضمان الاسترجاع" },
                  ].map(feature => (
                    <div
                      key={feature.label}
                      className="flex flex-col items-center gap-1.5 rounded-xl bg-[#FAF9F5] px-2 py-3"
                    >
                      <feature.icon className="size-4 text-[var(--brand)]" />
                      <span className="text-[10px] font-extrabold leading-4 text-[#66716B]">
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>

                {product.description && (
                  <div className="border-t border-[#F0EEE6] pt-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#2E3833]">
                      <Star className="size-4 text-[var(--warm)]" />
                      عن المنتج
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#66716B]">
                      {product.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#EFEDE5] bg-white p-5">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={onAccept}
              className="btn-press animate-cta-pulse flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-white shadow-cta"
            >
              <Banknote className="size-4" />
              نعم، أضفه لطلبي
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="btn-press text-sm font-bold text-[#8A938D] underline underline-offset-4"
            >
              لا شكرًا، أكمل الطلب الحالي
            </button>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold text-[#9AA49E]">
            <RotateCcw className="size-3.5" />
            يمكنك رفض العرض والاستمرار في طلبك الحالي دون أي تغيير.
          </p>
        </div>
      </div>
    </div>
  );
}
