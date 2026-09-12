import { useEffect, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type MessageOrderSettings = {
  enabled: boolean;
  title: string;
  welcomeMessage: string;
  instructions: string;
  buttonText: string;
};

type MessageOrderWidgetProps = {
  productId?: number;
};

export function MessageOrderWidget({ productId }: MessageOrderWidgetProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    wilaya: "",
    wilayaCode: "",
    municipality: "",
    address: "",
    message: "",
  });

  const settingsQuery = trpc.messageOrder.publicForProduct.useQuery(
    { productId: productId ?? 1 },
    { enabled: Boolean(productId) }
  );
  const settings = settingsQuery.data as MessageOrderSettings | undefined;

  const submit = trpc.messageOrder.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("تم إرسال طلبك بنجاح، سنتواصل معك قريباً.");
      setForm({
        customerName: "",
        customerPhone: "",
        wilaya: "",
        wilayaCode: "",
        municipality: "",
        address: "",
        message: "",
      });
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [submitted]);

  if (!productId || !settings || !settings.enabled) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate({
      ...form,
      productId,
    });
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-4 z-40 btn-press flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-extrabold text-white shadow-lift hover:bg-[var(--brand-strong)]"
        >
          <MessageCircle className="size-5" />
          {settings.title || "الطلب عبر الرسالة"}
        </button>
      )}
      {open && (
        <div
          dir="rtl"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-[24px] border border-[#E7E9E2] bg-white shadow-lift sm:inset-x-auto sm:left-4 sm:right-auto"
        >
          <div className="flex items-center justify-between border-b border-[#ECEDE6] p-4">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <MessageCircle className="size-4" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1F2A25]">
                {settings.title || "الطلب عبر الرسالة"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-lg text-[#8A938D] hover:bg-[#F1F3EE]"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 p-4">
            <p className="text-xs leading-6 text-[#79837D]">
              {settings.welcomeMessage ||
                "مرحبًا! يمكنك إرسال طلبك الآن عبر هذه النافذة."}
            </p>
            <p className="text-xs leading-6 text-[#8A938D]">
              {settings.instructions ||
                "أدخل بياناتك ثم اكتب رسالة بالمنتجات المطلوبة."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-extrabold text-[#4A554F]">
                الاسم الكامل
                <input
                  type="text"
                  required
                  value={form.customerName}
                  onChange={e =>
                    setForm(prev => ({ ...prev, customerName: e.target.value }))
                  }
                  placeholder="الاسم الكامل"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#E3E1D8] bg-white px-2.5 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
              </label>
              <label className="block text-xs font-extrabold text-[#4A554F]">
                رقم الهاتف
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={form.customerPhone}
                  onChange={e =>
                    setForm(prev => ({ ...prev, customerPhone: e.target.value }))
                  }
                  placeholder="05xxxxxxxx"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#E3E1D8] bg-white px-2.5 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-extrabold text-[#4A554F]">
                الولاية
                <input
                  type="text"
                  required
                  value={form.wilaya}
                  onChange={e =>
                    setForm(prev => ({ ...prev, wilaya: e.target.value }))
                  }
                  placeholder="الولاية"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#E3E1D8] bg-white px-2.5 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
              </label>
              <label className="block text-xs font-extrabold text-[#4A554F]">
                البلدية
                <input
                  type="text"
                  value={form.municipality}
                  onChange={e =>
                    setForm(prev => ({ ...prev, municipality: e.target.value }))
                  }
                  placeholder="البلدية"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#E3E1D8] bg-white px-2.5 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
              </label>
            </div>
            <label className="block text-xs font-extrabold text-[#4A554F]">
              العنوان
              <textarea
                required
                value={form.address}
                onChange={e =>
                  setForm(prev => ({ ...prev, address: e.target.value }))
                }
                rows={2}
                placeholder="العنوان بالتفصيل"
                className="mt-1.5 w-full resize-y rounded-lg border border-[#E3E1D8] bg-white px-2.5 py-2 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
              />
            </label>
            <label className="block text-xs font-extrabold text-[#4A554F]">
              رسالة الطلب
              <textarea
                required
                value={form.message}
                onChange={e =>
                  setForm(prev => ({ ...prev, message: e.target.value }))
                }
                rows={3}
                placeholder="اكتب رسالة تحتوي على المنتجات المطلوبة والكميات..."
                className="mt-1.5 w-full resize-y rounded-lg border border-[#E3E1D8] bg-white px-2.5 py-2 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
              />
            </label>
            <button
              type="submit"
              disabled={submit.isPending}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] disabled:opacity-60"
            >
              <Send className="size-4" />
              {submit.isPending
                ? "جارٍ الإرسال..."
                : settings.buttonText || "إرسال الطلب الآن"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
