import { ArrowRight, BadgePercent, Loader2, ShieldCheck, Truck } from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { DirectCodOrderForm } from "@/components/DirectCodOrderForm";

const formatPrice = (value: number | string | null | undefined, currency = "DZD") =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} ${currency === "EUR" ? "€" : currency === "USD" ? "$" : "دج"}`;

/**
 * Public bundle (pack) purchase page — the pack equivalent of a product page:
 * photo, contents, price and the COD order form. Reached from the storefront
 * packs section (/b/<slug>).
 */
export default function BundleLanding() {
  const [, params] = useRoute("/b/:slug");
  const slug = params?.slug ?? "";
  const query = trpc.offers.publicGet.useQuery(
    { slug },
    { enabled: Boolean(slug), retry: false }
  );
  const offer = query.data;

  if (query.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--paper,#FFFCF6)]">
        <Loader2 className="size-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (query.isError || !offer) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--paper,#FFFCF6)] px-4 text-center">
        <div>
          <p className="text-lg font-extrabold text-[#2E3833]">
            الباقة غير متوفرة حاليًا.
          </p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-4 rounded-2xl border border-[#E5E3DA] bg-white px-5 py-2.5 text-sm font-extrabold text-[#3F4A44]"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  const image =
    offer.imageUrl || offer.items[0]?.imageUrl || undefined;
  const { pricing } = offer;
  const currency = "DZD";

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--paper,#FFFCF6)] pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#5B6660] transition hover:text-[var(--brand)]"
        >
          <ArrowRight className="size-4" />
          العودة للمتجر
        </button>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#E7E5DC] bg-white shadow-soft">
            {image ? (
              <img
                src={image}
                alt={offer.name}
                className="h-64 w-full object-cover sm:h-80"
              />
            ) : (
              <div className="h-64 w-full bg-[var(--brand-soft,#E4F3EF)] sm:h-80" />
            )}
            <div className="space-y-3 p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warm-soft)] px-3 py-1 text-[11px] font-extrabold text-[var(--warm)]">
                <BadgePercent className="size-3.5" />
                باقة
              </span>
              <h1 className="text-2xl font-black text-[#2E3833]">{offer.name}</h1>
              {pricing.freeDelivery ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EE] px-3 py-1 text-[11px] font-extrabold text-[#0B7A4B]">
                  <Truck className="size-3.5" />
                  توصيل مجاني على الباقة
                </span>
              ) : null}

              <ul className="space-y-2 border-t border-[#EFEDE5] pt-4">
                {offer.items.map(item => (
                  <li
                    key={item.productId}
                    className="flex items-center gap-3 rounded-2xl border border-[#F1EFE7] bg-[#FBFBF8] p-2.5"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="size-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="size-14 shrink-0 rounded-xl bg-[#F0EEE6]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-[#2E3833]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-[#79837D]">
                        {item.quantity} × {formatPrice(item.price, currency)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-end gap-3 border-t border-[#EFEDE5] pt-4">
                <span className="text-2xl font-black text-[var(--brand-strong,#0B5D57)]">
                  {formatPrice(pricing.bundlePrice, currency)}
                </span>
                {pricing.originalTotal > pricing.bundlePrice ? (
                  <span className="pb-1 text-sm font-bold text-[#9AA49E] line-through decoration-2">
                    {formatPrice(pricing.originalTotal, currency)}
                  </span>
                ) : null}
                {pricing.discountAmount > 0 ? (
                  <span className="mb-1 rounded-full bg-[var(--warm-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--warm)]">
                    وفّر {formatPrice(pricing.discountAmount, currency)}
                  </span>
                ) : null}
              </div>

              <p className="flex items-center gap-1.5 text-xs font-bold text-[#79837D]">
                <ShieldCheck className="size-3.5 text-[var(--brand)]" />
                الدفع عند الاستلام — افحص طلبك قبل الدفع.
              </p>
            </div>
          </div>

          <div>
            <DirectCodOrderForm
              formId="bundle-order-form"
              productId={offer.items[0]?.productId ?? 0}
              productTitle={offer.name}
              price={String(pricing.bundlePrice)}
              productImageUrl={image}
              maxQuantity={10}
              bundle={{
                offerId: offer.id,
                freeDelivery: pricing.freeDelivery,
                items: offer.items.map(item => ({
                  productId: item.productId,
                  quantity: item.quantity,
                })),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
