import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
import { FormEvent, useState } from "react";

type DigitalOrderFormProps = {
  productId: number;
  productTitle: string;
  price: string;
  productImageUrl?: string;
  onOrderSuccess?: () => void;
};

const fieldClass =
  "mt-2 h-11 w-full rounded-2xl border border-[#E3E1D8] bg-white px-3.5 text-sm font-semibold text-[#242E29] outline-none transition duration-200 placeholder:font-medium placeholder:text-[#A7AFA9] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

const humanInvalid =
  (messages: { valueMissing?: string; typeMismatch?: string }) =>
  (event: FormEvent<HTMLInputElement>) => {
    const validity = event.currentTarget.validity;
    const message = validity.valueMissing
      ? messages.valueMissing
      : validity.typeMismatch
        ? messages.typeMismatch
        : undefined;
    if (message) event.currentTarget.setCustomValidity(message);
  };
const clearInvalid = (event: FormEvent<HTMLInputElement>) =>
  event.currentTarget.setCustomValidity("");

export function DigitalOrderForm({
  productId,
  productTitle,
  price,
  productImageUrl,
  onOrderSuccess,
}: DigitalOrderFormProps) {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    notes: "",
  });
  const [orderNumber, setOrderNumber] = useState<string>();
  const createOrder = trpc.digital.createOrder.useMutation({
    onSuccess: result => {
      setOrderNumber(result.orderNumber);
      onOrderSuccess?.();
    },
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createOrder.mutate({
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      notes: form.notes,
      lines: [{ productId, quantity: 1 }],
    });
  };
  if (orderNumber)
    return (
      <div className="animate-fade-up rounded-[24px] border border-[#CBE5D6] bg-[var(--brand-soft)] p-5">
        <div className="flex items-start gap-3">
          <div className="animate-check-pop grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-soft">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-[var(--brand-strong)]">
              تم تسجيل طلبك الرقمي
            </p>
            <p className="mt-1 text-xs leading-6 text-[#4A6257]">
              رقم الطلب: <b dir="ltr">{orderNumber}</b>. سيؤكد صاحب المتجر الدفع
              ثم ينشئ رابط التنزيل الآمن.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/75 p-3 text-xs leading-6 text-[#4A6257]">
          <Download className="mt-1 size-4 shrink-0" />
          لن تظهر معلومات التوصيل لأن هذا المنتج رقمي. سنستخدم البريد المرتبط
          بالطلب لإتمام التواصل.
        </div>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      className="rounded-[24px] border border-[#E7E5DC] bg-white p-5 shadow-soft"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {productImageUrl ? (
            <img
              src={productImageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Mail className="size-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-extrabold text-[var(--ink)]">
            اطلب المنتج الرقمي
          </p>
          <p className="mt-1 text-xs leading-6 text-[#66716B]">
            {productTitle} · {price}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <label className="text-xs font-extrabold text-[#2E3833]">
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
            className={fieldClass}
            placeholder="الاسم واللقب"
          />
        </label>
        <label className="text-xs font-extrabold text-[#2E3833]">
          البريد الإلكتروني
          <input
            required
            type="email"
            value={form.customerEmail}
            onInvalid={humanInvalid({
              valueMissing: "أدخل بريدك الإلكتروني — سنرسل إليه رابط التنزيل.",
              typeMismatch:
                "هذا البريد غير صحيح، تأكد من كتابته مثل: name@example.com",
            })}
            onChange={event => {
              clearInvalid(event);
              update("customerEmail", event.target.value);
            }}
            className={fieldClass}
            placeholder="name@example.com"
          />
        </label>
        <label className="text-xs font-extrabold text-[#2E3833]">
          ملاحظات <span className="font-medium text-[#9AA49E]">(اختياري)</span>
          <textarea
            value={form.notes}
            onChange={event => update("notes", event.target.value)}
            className={`${fieldClass} min-h-18 py-2`}
          />
        </label>
      </div>
      {createOrder.error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#F3D2CB] bg-[#FCE8E4] px-3 py-2.5 text-xs font-bold leading-5 text-[#A63D28]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {createOrder.error.message}
        </div>
      )}
      <button
        type="submit"
        disabled={createOrder.isPending}
        className="btn-press animate-cta-pulse mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-white shadow-cta disabled:cursor-not-allowed disabled:opacity-50 disabled:[animation:none]"
      >
        {createOrder.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            جارٍ تسجيل الطلب…
          </>
        ) : (
          <>
            <UserRound className="size-4" />
            إنشاء طلب المنتج الرقمي
          </>
        )}
      </button>
      <p className="mt-3 text-center text-[11px] leading-5 text-[#8A938D]">
        بعد تأكيد الدفع، يطبق المتجر حد مرات التحميل ومدة صلاحية الرابط المحددين
        لهذا المنتج.
      </p>
    </form>
  );
}
