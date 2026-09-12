import {
  AlertCircle,
  Banknote,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

const formatPrice = (value: string) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} دج`;
export const sameWilayaCode = (
  left?: string | number | null,
  right?: string | number | null
) =>
  String(left ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0") ===
  String(right ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
const statuses = {
  new: {
    label: "جديد · قيد التحصيل",
    className: "bg-[var(--warm-soft)] text-[#A8641F]",
    icon: PackageCheck,
  },
  review: {
    label: "مراجعة OrderClean",
    className: "bg-[#FCE8E4] text-[#A63D28]",
    icon: ShieldAlert,
  },
  confirmed: {
    label: "مؤكد",
    className: "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
    icon: PackageCheck,
  },
  processing: {
    label: "قيد التحضير",
    className: "bg-[#F1F3EE] text-[#4A5A52]",
    icon: Loader2,
  },
  at_carrier: {
    label: "عند شركة التوصيل",
    className: "bg-[#DDEAE2] text-[var(--brand)]",
    icon: Truck,
  },
  shipped: {
    label: "تم الشحن",
    className: "bg-[var(--brand-soft)] text-[var(--brand)]",
    icon: Send,
  },
  delivered: {
    label: "كوموند ليفري · تم التسليم",
    className: "bg-[#D8EBDF] text-[var(--brand-strong)]",
    icon: PackageCheck,
  },
  returned: {
    label: "كوموند روتور · تم الإرجاع",
    className: "bg-[#FBE6E1] text-[#A63D28]",
    icon: RotateCcw,
  },
  cancelled: {
    label: "ملغى",
    className: "bg-[#FCE8E4] text-[#A63D28]",
    icon: XCircle,
  },
  customer_unresponsive: {
    label: "الزبون لا يرد",
    className: "bg-[var(--warm-soft)] text-[#A8641F]",
    icon: Phone,
  },
  phone_cancelled: {
    label: "الهاتف ملغى",
    className: "bg-[#FCE8E4] text-[#A63D28]",
    icon: Phone,
  },
  fake: {
    label: "مزيفة",
    className: "bg-[#F1F2EE] text-[#6B7268]",
    icon: XCircle,
  },
} as const;
type EditableStatus =
  | "review"
  | "confirmed"
  | "processing"
  | "at_carrier"
  | "shipped"
  | "returned"
  | "cancelled"
  | "customer_unresponsive"
  | "phone_cancelled"
  | "fake";

export default function Orders() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [errorCopied, setErrorCopied] = useState(false);
  const [connectionId, setConnectionId] = useState<number | null>(null);
  const ordersQuery = trpc.orders.list.useQuery();
  const messageOrdersQuery = trpc.messageOrder.list.useQuery();
  const updateMessageOrderStatus = trpc.messageOrder.updateStatus.useMutation({
    onSuccess: async () => {
      await messageOrdersQuery.refetch();
      toast.success("تم تحديث حالة الطلب.");
    },
    onError: error => toast.error(error.message),
  });
  const carrierQuery = trpc.delivery.carriers.useQuery();
  const utils = trpc.useUtils();
  const updateStatus = trpc.orders.updateStatus.useMutation({
    onMutate: async variables => {
      await utils.orders.list.cancel();
      const previousOrders = utils.orders.list.getData();
      utils.orders.list.setData(undefined, current =>
        current?.map(order =>
          order.id === variables.orderId
            ? { ...order, fulfillmentStatus: variables.fulfillmentStatus }
            : order
        )
      );
      return { previousOrders };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrders)
        utils.orders.list.setData(undefined, context.previousOrders);
    },
    onSuccess: async (_order, variables) => {
      toast.success(
        `تم تحديث حالة الطلب إلى ${statuses[variables.fulfillmentStatus].label}.`
      );
      await utils.orders.list.invalidate();
    },
  });
  const bulkUpload = trpc.delivery.bulkUploadEcotrack.useMutation({
    onSuccess: async result => {
      setSelectedIds([]);
      const details = result.failed
        .map(item => `${item.orderNumber ?? "الطلب"}: ${item.error}`)
        .join("\n");
      setErrorCopied(false);
      setBulkError(
        result.tracked < result.submitted
          ? details || "راجع بيانات الطلبات وبيانات Ecotrack ثم أعد المحاولة."
          : null
      );
      if (result.tracked === result.submitted)
        toast.success(`تم قبول ${result.tracked} طلب في Ecotrack.`, {
          duration: 5000,
        });
      await utils.orders.list.invalidate();
    },
    onError: error => {
      setErrorCopied(false);
      setBulkError(error.message || "تعذر رفع الطلبات إلى Ecotrack.");
    },
  });
  const createShippingLabel = trpc.delivery.createShippingLabel.useMutation({
    onSuccess: async () => {
      toast.success("تم تنزيل وحفظ بوليصة الشحن.");
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncEcotrackStatus = trpc.delivery.syncEcotrackStatus.useMutation({
    onSuccess: async result => {
      const label =
        result.fulfillmentStatus === "delivered"
          ? "كوموند ليفري"
          : result.fulfillmentStatus === "returned"
            ? "كوموند روتور"
            : (result.carrierStatus ?? "لم تُرجع الشركة حالة معروفة");
      toast.success(`تمت مزامنة الحالة: ${label}`);
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const orders = useMemo(
    () =>
      (ordersQuery.data ?? []).filter(order => {
        const term = search.trim().toLocaleLowerCase("ar");
        return (
          !term ||
          order.orderNumber.toLocaleLowerCase("ar").includes(term) ||
          order.customerName.toLocaleLowerCase("ar").includes(term) ||
          order.customerPhone.includes(term)
        );
      }),
    [ordersQuery.data, search]
  );
  const ecotrackConnections = useMemo(
    () =>
      (carrierQuery.data ?? []).filter(
        item => item.provider === "ecotrack" && item.status === "connected"
      ),
    [carrierQuery.data]
  );
  useEffect(() => {
    if (connectionId === null && ecotrackConnections[0])
      setConnectionId(ecotrackConnections[0].id);
  }, [connectionId, ecotrackConnections]);
  const selectableIds = orders
    .filter(
      order =>
        !["cancelled", "fake", "phone_cancelled", "review"].includes(
          order.fulfillmentStatus
        )
    )
    .map(order => order.id);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every(id => selectedIds.includes(id));
  const setStatus = (orderId: number, fulfillmentStatus: EditableStatus) =>
    updateStatus.mutate({ orderId, fulfillmentStatus });
  const toggleOrder = (id: number) =>
    setSelectedIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  const uploadSelected = () => {
    if (!selectedIds.length) return toast.error("حدد طلبًا واحدًا على الأقل.");
    if (connectionId === null)
      return toast.error("أضف حساب Ecotrack ومكّنه أولًا.");
    bulkUpload.mutate({ orderIds: selectedIds, connectionId });
  };
  const createLabel = (order: (typeof orders)[number]) => {
    if (!order.carrierTracking)
      return toast.error(
        "ارفع الطلب إلى Ecotrack أولًا للحصول على رقم التتبع."
      );
    createShippingLabel.mutate({
      orderId: order.id,
      tracking: order.carrierTracking,
    });
  };
  const syncStatus = (order: (typeof orders)[number]) => {
    if (!order.carrierTracking)
      return toast.error(
        "ارفع الطلب إلى Ecotrack أولًا للحصول على رقم التتبع."
      );
    syncEcotrackStatus.mutate({ orderId: order.id });
  };

  return (
    <div className="home-scope" dir="rtl">
      <div className="home-aurora" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>
      <PageIntro
        eyebrow="التشغيل"
        title="الطلبات"
        description="تابع طلبات الدفع عند الاستلام، ارفع مجموعة إلى Ecotrack، ثم نزّل البوالص من مكان واحد."
        action={
          <div className="rounded-xl bg-[var(--brand-soft)] px-4 py-2 text-xs font-extrabold text-[var(--brand-strong)]">
            {ordersQuery.data?.length ?? 0} طلب محفوظ
          </div>
        }
      />
      <div className="home-card mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-transparent bg-[#F5F6F2] px-3 text-[#8A938D] transition focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0B5B43]/10 sm:max-w-xs">
          <Search className="size-4" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full bg-transparent text-sm text-[#1F2A25] outline-none placeholder:text-[#A8AFA9]"
            placeholder="ابحث برقم الطلب أو العميل"
            aria-label="ابحث برقم الطلب"
          />
        </label>
        <div className="inline-flex items-center gap-2 px-3 text-xs font-bold text-[#79837D]">
          <Banknote className="size-4 text-[var(--brand)]" />
          الدفع عند الاستلام
        </div>
      </div>
      <div className="home-card mb-5 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <input
            type="checkbox"
            aria-label="تحديد كل الطلبات القابلة للرفع"
            checked={allSelected}
            onChange={() => setSelectedIds(allSelected ? [] : selectableIds)}
            className="size-4 accent-[#0B5B43]"
          />
          <span className="text-xs font-extrabold text-[#4A5A52]">
            {selectedIds.length
              ? `${selectedIds.length} محدد`
              : "حدد طلبات الرفع الجماعي"}
          </span>
          {ecotrackConnections.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-extrabold text-[#4A5A52]">
              حساب الإرسال
              <select
                aria-label="اختيار حساب Ecotrack للرفع"
                value={connectionId ?? ""}
                onChange={event => setConnectionId(Number(event.target.value))}
                className="h-9 max-w-48 rounded-xl border border-[#E3E1D8] bg-white px-2 text-[11px] font-extrabold text-[var(--brand)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10"
              >
                <option value="" disabled>
                  اختر الحساب
                </option>
                {ecotrackConnections.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.accountName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Button
          onClick={uploadSelected}
          disabled={!selectedIds.length || bulkUpload.isPending}
          className="brand-shine btn-press h-11 rounded-xl bg-[var(--brand)] px-5 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
        >
          {bulkUpload.isPending ? (
            <Loader2 className="ml-2 size-4 animate-spin" />
          ) : (
            <Send className="ml-2 size-4" />
          )}
          رفع المحدد إلى Ecotrack
        </Button>
      </div>
      {bulkError && (
        <div
          role="alert"
          className="sticky top-3 z-30 mb-5 rounded-[20px] border border-[#F3D2CB] bg-[#FCE8E4] px-4 py-4 text-sm font-bold leading-7 text-[#A63D28] shadow-lift"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-extrabold">
              <AlertCircle className="size-4 shrink-0" />
              خطأ رفع Ecotrack — اقرأ التفاصيل هنا
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(bulkError);
                  setErrorCopied(true);
                }}
                className="btn-press text-xs font-extrabold underline"
              >
                {errorCopied ? "تم النسخ" : "نسخ التفاصيل"}
              </button>
              <button
                type="button"
                onClick={() => setBulkError(null)}
                className="btn-press text-xs font-extrabold underline"
              >
                إخفاء التنبيه
              </button>
            </div>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-right font-sans text-xs">
            {bulkError}
          </pre>
        </div>
      )}
      {updateStatus.error && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-[#F3D2CB] bg-[#FCE8E4] px-4 py-3 text-sm font-bold text-[#A63D28]">
          <AlertCircle className="size-4 shrink-0" />
          {updateStatus.error.message}
        </p>
      )}
      {messageOrdersQuery.data?.length ? (
        <div className="home-card mb-6 overflow-hidden">
          <div className="border-b border-[#ECEDE6] bg-[var(--brand-soft)] p-4">
            <h3 className="text-sm font-extrabold text-[var(--brand-strong)]">
              طلبات الرسائل ({messageOrdersQuery.data.length})
            </h3>
            <p className="mt-1 text-xs text-[#5B6B62]">
              طلبات وصلت عبر أداة «الطلب عبر الرسالة» في المتجر.
            </p>
          </div>
          <div className="divide-y divide-[#F0F1EA]">
            {messageOrdersQuery.data.map(msgOrder => (
              <div
                key={msgOrder.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-[#1F2A25]">
                    {msgOrder.customerName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#79837D]">
                    {msgOrder.customerPhone} · {msgOrder.wilaya}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[#8A938D]">
                    {msgOrder.message}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                      msgOrder.status === "new"
                        ? "bg-[var(--warm-soft)] text-[#A8641F]"
                        : msgOrder.status === "converted"
                          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "bg-[#F1F3EE] text-[#4A554F]"
                    }`}
                  >
                    {msgOrder.status === "new"
                      ? "جديد"
                      : msgOrder.status === "converted"
                        ? "محوّل لطلب"
                        : msgOrder.status === "review"
                          ? "مراجعة"
                          : "مؤرشف"}
                  </span>
                  {msgOrder.status === "new" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-[10px] font-extrabold"
                      onClick={() =>
                        updateMessageOrderStatus.mutate({
                          id: msgOrder.id,
                          status: "review",
                        })
                      }
                    >
                      مراجعة
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {ordersQuery.isLoading ? (
        <div className="grid min-h-80 place-items-center">
          <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
        </div>
      ) : orders.length ? (
        <div className="home-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-right">
              <thead className="border-b border-[#EEEFE8] bg-[#FAFAF7] text-xs font-extrabold text-[#8A938D]">
                <tr>
                  <th className="px-5 py-4">رفع</th>
                  <th className="px-5 py-4">الطلب</th>
                  <th className="px-5 py-4">العميل</th>
                  <th className="px-5 py-4">العنوان</th>
                  <th className="px-5 py-4">المنتج</th>
                  <th className="px-5 py-4">الإجمالي</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4">تحديث الحالة</th>
                  <th className="px-5 py-4">الشحن</th>
                  <th className="px-5 py-4">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const current = statuses[order.fulfillmentStatus];
                  const StatusIcon = current.icon;
                  const selectable = ![
                    "cancelled",
                    "fake",
                    "phone_cancelled",
                    "review",
                  ].includes(order.fulfillmentStatus);
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[#F0F1EA] transition-colors duration-200 last:border-0 hover:bg-[#FAFBF7]"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          aria-label={`تحديد ${order.orderNumber}`}
                          checked={selectedIds.includes(order.id)}
                          disabled={!selectable}
                          onChange={() => toggleOrder(order.id)}
                          className="size-4 accent-[#0B5B43]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-[var(--brand)]">
                          {order.orderNumber}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8A938D]">
                          {new Date(order.createdAt).toLocaleDateString(
                            "ar-DZ"
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                          <UserRound className="size-4 text-[var(--brand)]" />
                          {order.customerName}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#79837D]">
                          <Phone className="size-3.5" />
                          {order.customerPhone}
                        </p>
                      </td>
                      <td className="max-w-64 px-5 py-4">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[#4A5A52]">
                          <MapPin className="size-3.5 text-[var(--brand)]" />
                          {order.wilaya}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#8A938D]">
                          {order.address}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-56 flex-col gap-1">
                          {order.items.map(item => (
                            <button
                              key={item.id}
                              onClick={() =>
                                setLocation(`/products/${item.productId}/edit`)
                              }
                              className="truncate text-left text-xs font-extrabold text-[var(--brand)] transition-colors duration-200 hover:text-[var(--brand-strong)]"
                            >
                              {item.title}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-extrabold text-[#1F2A25]">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${current.className}`}
                        >
                          <StatusIcon
                            className={`size-3.5 ${order.fulfillmentStatus === "processing" ? "animate-spin" : ""}`}
                          />
                          {current.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          disabled={
                            updateStatus.isPending ||
                            ["delivered", "returned"].includes(
                              order.fulfillmentStatus
                            )
                          }
                          value={order.fulfillmentStatus}
                          onChange={event =>
                            setStatus(
                              order.id,
                              event.target.value as EditableStatus
                            )
                          }
                          aria-label={`تحديث حالة ${order.orderNumber}`}
                          className="h-9 min-w-36 rounded-xl border border-[#E3E1D8] bg-white px-2 text-xs font-extrabold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10 disabled:cursor-not-allowed disabled:bg-[#F5F6F2]"
                        >
                          <option value="new" disabled>
                            جديد
                          </option>
                          <option value="review">مراجعة OrderClean</option>
                          <option value="confirmed">مؤكد</option>
                          <option value="processing">قيد التحضير</option>
                          <option value="at_carrier">عند شركة التوصيل</option>
                          <option value="shipped">تم الشحن</option>
                          <option value="delivered">
                            كوموند ليفري · تم التسليم
                          </option>
                          <option value="returned">
                            كوموند روتور · تم الإرجاع
                          </option>
                          <option value="cancelled">ملغى</option>
                          <option value="customer_unresponsive">
                            الزبون لا يرد
                          </option>
                          <option value="phone_cancelled">الهاتف ملغى</option>
                          <option value="fake">مزيفة</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <button
                            onClick={() => createLabel(order)}
                            disabled={createShippingLabel.isPending}
                            className="btn-press inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#D8E4DC] bg-[var(--brand-soft)] px-3 text-xs font-extrabold text-[var(--brand-strong)] transition hover:bg-[#DDEAE2] disabled:opacity-50"
                          >
                            <FileText className="size-3.5" />
                            {order.shippingLabelUrl
                              ? "إعادة تنزيل البوليصة"
                              : "إنشاء بوليصة"}
                          </button>
                          {order.carrierTracking && (
                            <>
                              <span className="text-[10px] font-bold text-[#79837D]">
                                تتبع: {order.carrierTracking}
                              </span>
                              <button
                                onClick={() => syncStatus(order)}
                                disabled={syncEcotrackStatus.isPending}
                                className="btn-press inline-flex h-8 items-center gap-1 rounded-xl border border-[#E3E1D8] bg-white px-2.5 text-[10px] font-extrabold text-[var(--brand)] transition hover:bg-[#F5F6F2] disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`size-3 ${syncEcotrackStatus.isPending ? "animate-spin" : ""}`}
                                />
                                مزامنة الحالة
                              </button>
                            </>
                          )}
                          {order.carrierStatus && (
                            <span className="text-[10px] font-bold text-[#79837D]">
                              حالة الشركة: {order.carrierStatus}
                            </span>
                          )}
                          {order.shippingLabelUrl && (
                            <a
                              href={order.shippingLabelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-extrabold text-[var(--brand)] underline-offset-2 hover:underline"
                            >
                              تنزيل PDF المحفوظ
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            setLocation(`/orders/${order.id}/edit`)
                          }
                          className="btn-press grid size-8 place-items-center rounded-lg border border-[#E3E1D8] bg-white text-[var(--brand)] transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={search ? "لا توجد طلبات مطابقة" : "لا توجد طلبات بعد"}
          description={
            search
              ? "جرّب البحث برقم طلب أو باسم العميل."
              : "ستظهر هنا الطلبات التي يؤكدها العملاء بالدفع عند الاستلام من واجهة المتجر."
          }
          action={
            !search ? (
              <Button
                variant="outline"
                className="rounded-xl border-[#E3E1D8] bg-white px-5 font-bold text-[#4A5A52]"
              >
                الطلبات تُحفظ تلقائيًا
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
