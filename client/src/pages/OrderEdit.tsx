import { useAuth } from "@/_core/hooks/useAuth";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Loader2,
  MapPin,
  Package,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type OrderForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  wilaya: string;
  wilayaCode: string;
  municipality: string;
  carrierMunicipality: string;
  deliveryMethod: "office" | "home";
  address: string;
  notes: string;
  fulfillmentStatus:
    | "new"
    | "review"
    | "confirmed"
    | "processing"
    | "at_carrier"
    | "shipped"
    | "delivered"
    | "returned"
    | "cancelled"
    | "customer_unresponsive"
    | "phone_cancelled"
    | "fake";
};

export default function OrderEdit() {
  const [, params] = useRoute("/orders/:id/edit");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const id = Number(params?.id);
  const orderQuery = trpc.orders.getById.useQuery(
    { orderId: id },
    { enabled: isAuthenticated && Number.isFinite(id) }
  );
  const updateOrder = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الطلب.");
      setLocation("/orders");
    },
    onError: error => toast.error(error.message || "تعذر حفظ التعديل."),
  });

  const [form, setForm] = useState<OrderForm>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    wilaya: "",
    wilayaCode: "",
    municipality: "",
    carrierMunicipality: "",
    deliveryMethod: "home",
    address: "",
    notes: "",
    fulfillmentStatus: "new",
  });

  useEffect(() => {
    if (orderQuery.data) {
      const order = orderQuery.data;
      setForm({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail ?? "",
        wilaya: order.wilaya,
        wilayaCode: order.wilayaCode ?? "",
        municipality: order.municipality ?? "",
        carrierMunicipality: order.carrierMunicipality ?? "",
        deliveryMethod: order.deliveryMethod,
        address: order.address,
        notes: order.notes ?? "",
        fulfillmentStatus: order.fulfillmentStatus,
      });
    }
  }, [orderQuery.data]);

  const handleChange = <K extends keyof OrderForm>(
    field: K,
    value: OrderForm[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrder.mutate({
      orderId: id,
      ...form,
    });
  };

  if (orderQuery.isLoading) {
    return (
      <div className="grid min-h-72 place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (!orderQuery.data) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm font-bold text-[#8A938D]">
        الطلب غير موجود.
      </div>
    );
  }

  const order = orderQuery.data;

  return (
    <div dir="rtl">
      <PageIntro
        eyebrow="الطلبات"
        title={`تعديل الطلب #${order.orderNumber}`}
        description="عدّل بيانات العميل ومعلومات التوصيل والبنود."
        action={
          <Button
            variant="outline"
            onClick={() => setLocation("/orders")}
            className="rounded-xl border border-[#E3E1D8] bg-white px-5 font-bold text-[#4A5A52]"
          >
            <ArrowRight className="ml-2 size-4" />
            العودة للطلبات
          </Button>
        }
      />
      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-[#4A5A52]">
              <UserRound className="size-3.5 text-[var(--brand)]" />
              الاسم الكامل
            </label>
            <input
              value={form.customerName}
              onChange={e => handleChange("customerName", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-[#4A5A52]">
              <Phone className="size-3.5 text-[var(--brand)]" />
              رقم الهاتف
            </label>
            <input
              value={form.customerPhone}
              onChange={e => handleChange("customerPhone", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
              البريد الإلكتروني
            </label>
            <input
              value={form.customerEmail}
              onChange={e => handleChange("customerEmail", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-[#4A5A52]">
              <MapPin className="size-3.5 text-[var(--brand)]" />
              الولاية
            </label>
            <input
              value={form.wilaya}
              onChange={e => handleChange("wilaya", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
              البلدية
            </label>
            <input
              value={form.municipality}
              onChange={e => handleChange("municipality", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
              عنوان التوصيل
            </label>
            <input
              value={form.address}
              onChange={e => handleChange("address", e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
              طريقة التوصيل
            </label>
            <select
              value={form.deliveryMethod}
              onChange={e =>
                handleChange("deliveryMethod", e.target.value as "office" | "home")
              }
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            >
              <option value="home">توصيل للمنزل</option>
              <option value="office">استلام من المكتب</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
              حالة الطلب
            </label>
            <select
              value={form.fulfillmentStatus}
              onChange={e =>
                handleChange(
                  "fulfillmentStatus",
                  e.target.value as OrderForm["fulfillmentStatus"]
                )
              }
              className="h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
            >
              <option value="new">جديد</option>
              <option value="confirmed">مؤكد</option>
              <option value="processing">قيد التحضير</option>
              <option value="at_carrier">عند شركة التوصيل</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التسليم</option>
              <option value="returned">تم الإرجاع</option>
              <option value="cancelled">ملغى</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-extrabold text-[#4A5A52]">
            ملاحظات
          </label>
          <textarea
            value={form.notes}
            onChange={e => handleChange("notes", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[#E3E1D8] bg-white px-3 py-2 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
          />
        </div>
        <div className="rounded-[16px] border border-[#E7E9E2] bg-[#FAFAF7] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#4A5A52]">
            <Package className="size-4 text-[var(--brand)]" />
            بنود الطلب
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse text-right">
              <thead>
                <tr className="border-b border-[#E7E9E2] text-[11px] font-extrabold text-[#8A938D]">
                  <th className="px-3 py-2">المنتج</th>
                  <th className="px-3 py-2">الكمية</th>
                  <th className="px-3 py-2">السعر</th>
                </tr>
              </thead>
              <tbody>
                {(order.items as any[]).map(item => (
                  <tr key={item.id} className="border-b border-[#F0F1EA] last:border-0">
                    <td className="px-3 py-2 text-xs font-bold text-[#1F2A25]">
                      {item.title}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-[#1F2A25]">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-[#1F2A25]">
                      {item.unitPrice} دج
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="submit"
            disabled={updateOrder.isPending}
            className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            {updateOrder.isPending ? (
              <Loader2 className="ml-2 size-4 animate-spin" />
            ) : (
              <Save className="ml-2 size-4" />
            )}
            حفظ التعديلات
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/orders")}
            className="rounded-xl border-[#E3E1D8] bg-white px-5 font-bold text-[#4A5A52]"
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}