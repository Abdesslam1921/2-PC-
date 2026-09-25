import { BrandLockup } from "@/components/BrandLockup";
import FloatingChatbot from "@/components/FloatingChatbot";
import { ThankYouPopup } from "@/components/ThankYouPopup";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

const formatPrice = (value: number) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(value)} دج`;

type Confirmation = {
  orderNumber: string;
  total: string;
  productId: number;
  digital: boolean;
};

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#E3E1D8] bg-white px-3.5 text-sm font-semibold text-[#242E29] outline-none transition duration-200 placeholder:font-medium placeholder:text-[#A7AFA9] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";
const labelClass = "block text-sm font-extrabold text-[#2E3833]";

const humanInvalid =
  (messages: {
    valueMissing?: string;
    patternMismatch?: string;
    typeMismatch?: string;
  }) =>
  (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const validity = event.currentTarget.validity;
    const message = validity.valueMissing
      ? messages.valueMissing
      : validity.patternMismatch
        ? messages.patternMismatch
        : validity.typeMismatch
          ? messages.typeMismatch
          : undefined;
    if (message) event.currentTarget.setCustomValidity(message);
  };
const clearInvalid = (
  event: FormEvent<HTMLInputElement | HTMLTextAreaElement>
) => event.currentTarget.setCustomValidity("");

export default function Checkout() {
  const [, setLocation] = useLocation();
  const {
    items,
    subtotal,
    itemCount,
    // Defensive defaults: with no bundles the discount is zero and the total is
    // the subtotal, so a partial mock can never crash the summary.
    bundleDiscount = 0,
    total = subtotal,
    bundles = [],
    clearCart,
  } = useCart();
  const isDigitalCart =
    items.length > 0 && items.every(item => item.productKind === "digital");
  const isMixedCart =
    items.some(item => item.productKind === "digital") && !isDigitalCart;
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    wilaya: "",
    address: "",
    notes: "",
  });
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
  const createPhysicalOrder = trpc.orders.createCod.useMutation({
    onSuccess: result => {
      clearCart();
      setConfirmed({
        orderNumber: result.orderNumber,
        total: result.total,
        productId: items[0]?.productId ?? 0,
        digital: false,
      });
    },
  });
  const createDigitalOrder = trpc.digital.createOrder.useMutation({
    onSuccess: result => {
      clearCart();
      setConfirmed({
        orderNumber: result.orderNumber,
        total: result.total,
        productId: items[0]?.productId ?? 0,
        digital: true,
      });
    },
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!items.length || isMixedCart) return;
    if (isDigitalCart)
      createDigitalOrder.mutate({
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        notes: form.notes,
        lines: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
    else
      createPhysicalOrder.mutate({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        wilaya: form.wilaya,
        address: form.address,
        notes: form.notes,
        deliveryMethod: "home",
        lines: items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          offerId: item.offerId,
          quantity: item.quantity,
        })),
        /**
         * Bundles: only ids + how many times. The server recomputes the amounts
         * and rejects the order if availability or quantities changed.
         */
        appliedOffers: bundles.length
          ? bundles.map(bundle => ({
              offerId: bundle.offerId,
              times: bundle.times,
            }))
          : undefined,
      });
  };
  const pending = createPhysicalOrder.isPending || createDigitalOrder.isPending;
  const error =
    createPhysicalOrder.error?.message || createDigitalOrder.error?.message;

  if (confirmed)
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[var(--paper)] text-[var(--ink)]"
      >
        <div className="bg-[var(--brand-strong)] px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-white">
          {confirmed.digital
            ? "تم تسجيل طلب المنتج الرقمي"
            : "تم تسجيل طلبك للدفع عند الاستلام"}
        </div>
        <header className="border-b border-[#EAE8E0] bg-white px-4 py-3.5 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <BrandLockup />
            <button
              onClick={() => setLocation("/store")}
              className="text-xs font-extrabold text-[var(--brand)]"
            >
              العودة للمتجر
            </button>
          </div>
        </header>
        <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12 text-center">
          <section className="w-full rounded-[30px] border border-[#E3EDE7] bg-white p-8 shadow-lift sm:p-12">
            <div className="animate-check-pop mx-auto grid size-18 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
              <CheckCircle2 className="size-10" />
            </div>
            <p className="mt-6 text-sm font-extrabold text-[var(--brand)]">
              تم استلام الطلب
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
              شكرًا لثقتك في عبدو ستور
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#66716B]">
              {confirmed.digital
                ? "تم حفظ طلبك. بعد تأكيد الدفع من المتجر سيُنشأ رابط تنزيل آمن ومؤقت للملف ويرسل عبر البريد المرتبط بالطلب."
                : "سيتواصل معك فريق المتجر لتأكيد الطلب والدفع عند الاستلام."}
            </p>
            <div className="mt-7 rounded-2xl border border-[#E3EDE7] bg-[var(--brand-soft)] px-5 py-4">
              <p className="text-xs font-bold text-[#5F7A6D]">رقم الطلب</p>
              <p className="mt-1 text-xl font-extrabold tracking-wide text-[var(--brand-strong)]">
                {confirmed.orderNumber}
              </p>
              <p className="mt-2 text-sm font-extrabold text-[#2E3833]">
                الإجمالي: {formatPrice(Number(confirmed.total))}
              </p>
            </div>
            {confirmed.digital ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4 text-right text-xs leading-6 text-[#8A6327]">
                <Download className="mt-1 size-4 shrink-0" />
                <p>
                  رابط التنزيل لا يُفتح قبل تأكيد الدفع، وله مدة صلاحية وعدد
                  مرات تنزيل محددان من صاحب المتجر.
                </p>
              </div>
            ) : (
              <ThankYouPopup
                productId={confirmed.productId}
                orderNumber={confirmed.orderNumber}
                total={confirmed.total}
                onClose={() => setLocation("/store")}
              />
            )}
            <button
              onClick={() => setLocation("/store")}
              className="btn-press mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand)] px-6 text-sm font-extrabold text-white shadow-cta"
            >
              متابعة التسوق
              <ArrowLeft className="size-4" />
            </button>
          </section>
        </main>
      </div>
    );

  if (!items.length)
    return <EmptyCheckout onBack={() => setLocation("/store")} />;
  if (isMixedCart)
    return (
      <div
        dir="rtl"
        className="grid min-h-screen place-items-center bg-[var(--paper)] px-4 text-center"
      >
        <div className="animate-fade-up max-w-md rounded-[28px] border border-[#E9E7DE] bg-white p-8 shadow-lift">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <ShoppingBag className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-[var(--ink)]">
            افصل أنواع المنتجات
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#66716B]">
            لا يمكن جمع منتج مادي ومنتج رقمي في نفس الطلب، لأن المنتج الرقمي لا
            يحتاج معلومات توصيل. أتمم أحدهما أولًا ثم اطلب الآخر.
          </p>
          <button
            onClick={() => setLocation("/store/cart")}
            className="btn-press mt-6 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-extrabold text-white shadow-cta"
          >
            العودة إلى السلة
          </button>
        </div>
      </div>
    );

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="bg-[var(--brand-strong)] px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-white">
        {isDigitalCart
          ? "تسليم رقمي آمن بعد تأكيد الدفع"
          : "الدفع عند الاستلام متاح للطلبات المسجلة"}
      </div>
      <header className="sticky top-0 z-30 border-b border-[#EAE8E0] bg-[color-mix(in_oklab,white_86%,transparent)] px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button onClick={() => setLocation("/store")}>
            <BrandLockup />
          </button>
          <button
            onClick={() => setLocation("/store/cart")}
            className="btn-press relative grid size-10 place-items-center rounded-xl border border-[#D9E5DD] bg-[var(--brand-soft)] text-[var(--brand)]"
            aria-label="السلة"
          >
            <ShoppingCart className="size-[19px]" />
            <span className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--brand)] text-[10px] font-extrabold text-white">
              {itemCount}
            </span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <button
          onClick={() => setLocation("/store/cart")}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand)]"
        >
          <ArrowRight className="size-4" />
          العودة إلى السلة
        </button>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={submit}
            className="rounded-[28px] border border-[#E9E7DE] bg-white p-5 shadow-soft sm:p-8"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand)]">
              <ShieldCheck className="size-4" />
              إتمام الطلب
            </span>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
              {isDigitalCart ? "بيانات التسليم الرقمي" : "بيانات الاستلام"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#66716B]">
              {isDigitalCart
                ? "أدخل بريدًا إلكترونيًا صحيحًا ليستعمله المتجر لإرسال رابط التنزيل بعد تأكيد الدفع."
                : "أدخل بياناتك بدقة لتأكيد الطلب والدفع نقدًا عند الاستلام."}
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                الاسم الكامل
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
              {isDigitalCart ? (
                <label className={labelClass}>
                  البريد الإلكتروني
                  <input
                    required
                    type="email"
                    value={form.customerEmail}
                    onInvalid={humanInvalid({
                      valueMissing:
                        "أدخل بريدك الإلكتروني — سنرسل إليه رابط التنزيل.",
                      typeMismatch:
                        "هذا البريد غير صحيح، تأكد من كتابته مثل: name@example.com",
                    })}
                    onChange={event => {
                      clearInvalid(event);
                      update("customerEmail", event.target.value);
                    }}
                    placeholder="name@example.com"
                    className={fieldClass}
                  />
                </label>
              ) : (
                <label className={labelClass}>
                  رقم الهاتف
                  <input
                    required
                    inputMode="tel"
                    value={form.customerPhone}
                    onInvalid={humanInvalid({
                      valueMissing:
                        "أدخل رقم هاتفك — نحتاجه للاتصال بك وتأكيد الطلب.",
                    })}
                    onChange={event => {
                      clearInvalid(event);
                      update("customerPhone", event.target.value);
                    }}
                    placeholder="05xxxxxxxx"
                    className={fieldClass}
                  />
                </label>
              )}
              {!isDigitalCart && (
                <>
                  <label className={`${labelClass} sm:col-span-2`}>
                    الولاية
                    <input
                      required
                      value={form.wilaya}
                      onInvalid={humanInvalid({
                        valueMissing: "اكتب اسم ولايتك حتى نرتب التوصيل.",
                      })}
                      onChange={event => {
                        clearInvalid(event);
                        update("wilaya", event.target.value);
                      }}
                      placeholder="مثال: الجزائر"
                      className={fieldClass}
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    العنوان بالتفصيل
                    <textarea
                      required
                      value={form.address}
                      onInvalid={humanInvalid({
                        valueMissing:
                          "اكتب عنوانك بالتفصيل (الحي، الشارع، رقم المنزل) حتى يصلك الطلب.",
                      })}
                      onChange={event => {
                        clearInvalid(event);
                        update("address", event.target.value);
                      }}
                      placeholder="الحي، الشارع، رقم المنزل"
                      className={`${fieldClass} min-h-25 resize-y py-3`}
                    />
                  </label>
                </>
              )}
              <label className={`${labelClass} sm:col-span-2`}>
                ملاحظات{" "}
                <span className="font-medium text-[#9AA49E]">(اختياري)</span>
                <textarea
                  value={form.notes}
                  onChange={event => update("notes", event.target.value)}
                  placeholder="أي تفاصيل إضافية"
                  className={`${fieldClass} min-h-20 resize-y py-3`}
                />
              </label>
            </div>
            <div className="mt-7 rounded-2xl border border-[#DDE8E1] bg-[var(--brand-soft)] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-soft">
                  {isDigitalCart ? (
                    <Mail className="size-5" />
                  ) : (
                    <Banknote className="size-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#2E3833]">
                    {isDigitalCart ? "الدفع الإلكتروني" : "الدفع عند الاستلام"}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[#66716B]">
                    {isDigitalCart
                      ? "سيبقى الطلب قيد الانتظار حتى يؤكد صاحب المتجر الدفع، ثم يُنشأ الرابط الآمن."
                      : "لن يُطلب منك أي دفع إلكتروني الآن؛ تُدفع قيمة الطلب عند استلامه."}
                  </p>
                </div>
                <CheckCircle2 className="mr-auto size-5 shrink-0 text-[#1E8F5F]" />
              </div>
            </div>
            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#F3D2CB] bg-[#FCE8E4] px-4 py-3 text-sm font-bold leading-6 text-[#A63D28]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}
            <button
              disabled={pending}
              type="submit"
              className="btn-press animate-cta-pulse mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-base font-extrabold text-white shadow-cta disabled:cursor-not-allowed disabled:opacity-55 disabled:[animation:none]"
            >
              {pending ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  جارٍ تسجيل الطلب…
                </>
              ) : (
                <>
                  {isDigitalCart
                    ? "إنشاء طلب الدفع"
                    : "تأكيد الطلب والدفع عند الاستلام"}
                  <ArrowLeft className="size-4" />
                </>
              )}
            </button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold text-[#79837D]">
              <ShieldCheck className="size-3.5 text-[var(--brand)]" />
              {isDigitalCart
                ? "بريدك يُستخدم فقط لإرسال رابط التنزيل"
                : "الدفع عند الاستلام — لا تحتاج بطاقة بنكية"}
            </p>
          </form>
          <aside className="h-fit rounded-[28px] border border-[#DDE8E1] bg-[var(--brand-soft)] p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-[var(--ink)]">
              ملخص الطلب
            </h2>
            <div className="mt-5 space-y-4">
              {items.map(item => (
                <div key={item.lineId} className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-[#9DB4A9] shadow-soft">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[#2E3833]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[#79837D]">
                      {item.offerDescription
                        ? `${item.offerDescription} · `
                        : ""}
                      الكمية: {item.quantity}
                    </p>
                    {item.freeDelivery && (
                      <p className="mt-1 text-[10px] font-extrabold text-[#1E8F5F]">
                        توصيل مجاني
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-[var(--brand-strong)]">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-[#D3E2D9] pt-4 text-sm">
              <div className="flex justify-between text-[#66716B]">
                <span>المنتجات</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {bundleDiscount > 0 ? (
                <div className="flex justify-between font-bold text-[var(--brand-strong)]">
                  <span>
                    خصم العروض
                    {bundles.length > 1 ? ` (${bundles.length})` : ""}
                  </span>
                  <span>−{formatPrice(bundleDiscount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-[#66716B]">
                <span>{isDigitalCart ? "التسليم" : "التوصيل"}</span>
                <span>
                  {isDigitalCart ? "رابط آمن بعد الدفع" : "يُحدد عند التأكيد"}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-base font-extrabold text-[var(--brand-strong)]">
                <span>الإجمالي</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <p className="mt-5 flex gap-2 text-xs leading-6 text-[#66716B]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
              {isDigitalCart
                ? "لن يظهر الملف الأصلي في الكتالوج أو في رابط عام."
                : "سيتم تأكيد تفاصيل التوصيل عبر رقم الهاتف المسجل."}
            </p>
            {!isDigitalCart && (
              <p className="mt-3 flex gap-2 text-xs leading-6 text-[#66716B]">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
                الطلب يحفظ مع حالة دفع «قيد التحصيل».
              </p>
            )}
            {isDigitalCart && (
              <p className="mt-3 flex gap-2 text-xs leading-6 text-[#66716B]">
                <Mail className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
                سيُستخدم بريدك لإرسال رابط التنزيل عند تأكيد الدفع.
              </p>
            )}
          </aside>
        </div>
      </main>
      <FloatingChatbot audience="buyer" />
    </div>
  );
}

function EmptyCheckout({ onBack }: { onBack: () => void }) {
  return (
    <div
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[var(--paper)] px-4 text-center"
    >
      <div className="animate-fade-up">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <ShoppingBag className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-[var(--ink)]">
          أضف منتجات قبل إتمام الطلب
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#79837D]">
          ستظهر بيانات التسليم أو البريد الإلكتروني بعد إضافة منتج متاح إلى
          السلة.
        </p>
        <button
          onClick={onBack}
          className="btn-press mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white shadow-cta"
        >
          تصفح المنتجات
          <ArrowLeft className="size-4" />
        </button>
      </div>
    </div>
  );
}
