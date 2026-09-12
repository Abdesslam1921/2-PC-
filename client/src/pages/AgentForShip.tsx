import { useMemo, useState } from "react";
import { Archive, Package, RefreshCw, Search, Trash2, Truck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const orderStatusLabels: Record<string, string> = {
  new: "جديد",
  review: "مراجعة",
  confirmed: "مؤكد",
  processing: "قيد التحضير",
  at_carrier: "عند شركة التوصيل",
  shipped: "تم الشحن",
  delivered: "كوموند ليفري · مكتملة",
  returned: "كوموند روتور · مرجعة",
  cancelled: "ملغاة",
  customer_unresponsive: "الزبون لا يرد",
  phone_cancelled: "الهاتف ملغى",
  fake: "مزيفة",
};
const finalStatuses = new Set([
  "delivered",
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
]);
const carrierLabels: Record<string, string> = {
  order_information_received_by_carrier: "تم استلام معلومات الطلب",
  picked: "تم الاستلام",
  accepted_by_carrier: "مقبول لدى الشركة",
  dispatched_to_driver: "قيد التوصيل",
  attempt_delivery: "محاولة توصيل",
  return_asked: "طلب إرجاع",
  return_in_transit: "الإرجاع قيد النقل",
  return_received: "تم استلام المرتجع",
  livred: "تم التسليم",
  encassed: "تم التحصيل",
  payed: "تم الدفع",
  cancelled: "ملغى",
  failed: "تعذر التنفيذ",
  delivered: "تم التسليم",
  returned: "مرتجع",
  in_transit: "قيد التوصيل",
  processing: "قيد المعالجة لدى الشركة",
  pending: "في انتظار معالجة الشركة",
};
const carrierLabel = (status: string | null | undefined) =>
  status
    ? (carrierLabels[status.toLowerCase()] ?? status)
    : "في انتظار حالة شركة الشحن";

type OrderLike = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  fulfillmentStatus: string;
  carrierTracking: string | null;
  carrierStatus: string | null;
  carrierStatusUpdatedAt: Date | null;
  items: Array<{ productId: number; title: string; quantity: number }>;
};

type Props = {
  token: string;
  orders: OrderLike[];
  products: Array<{ id: number; title: string }>;
  fullAccess?: boolean;
};

export default function AgentForShip({
  token,
  orders,
  products,
  fullAccess = false,
}: Props) {
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("all");
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Record<number, File>>({});
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const invalidate = () => utils.callCenter.dashboard.invalidate({ token });

  const sync = trpc.callCenter.syncOrderStatus.useMutation({
    onSuccess: result => {
      toast.success(
        `تمت مزامنة الحالة: ${orderStatusLabels[result.fulfillmentStatus] ?? result.carrierStatus ?? "محدثة"}`
      );
      void invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncAll = trpc.callCenter.syncAllOrderStatuses.useMutation({
    onSuccess: result => {
      toast.success(
        `تمت المزامنة: ${result.synced} طلبًا · ${result.delivered} تم التسليم · ${result.returned} مرتجع · ${result.cancelled} ملغى.`
      );
      void invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteOne = trpc.callCenter.deleteArchivedOrder.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الطلب من الأرشيف نهائيًا.");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteMany = trpc.callCenter.deleteOrders.useMutation({
    onSuccess: async result => {
      toast.success(`تم حذف ${result.deleted} طلبًا من الأرشيف.`);
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const sendMediaToWhatsApp = trpc.callCenter.sendMediaToWhatsApp.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الملف إلى واتساب بنجاح!");
    },
    onError: error => toast.error(error.message),
  });

  const handleFileSelect = (orderId: number, file: File) =>
    setUploadingFiles(current => ({ ...current, [orderId]: file }));

  const handleCaptionChange = (orderId: number, caption: string) =>
    setCaptions(current => ({ ...current, [orderId]: caption }));

  const handleSendToWhatsApp = async (orderId: number) => {
    const file = uploadingFiles[orderId];
    if (!file) {
      toast.error("يرجى اختيار ملف للإرسال");
      return;
    }
    setUploadingOrderId(orderId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orderId", orderId.toString());
      const uploadResponse = await fetch("/api/upload-whatsapp-media-agent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadResponse.ok) {
        const error = (await uploadResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error.error || "فشل رفع الملف");
      }
      const uploadResult = (await uploadResponse.json()) as { url?: string };
      if (!uploadResult.url) throw new Error("تعذر الحصول على رابط الملف.");
      await sendMediaToWhatsApp.mutateAsync({
        token,
        orderId,
        mediaUrl: uploadResult.url,
        caption: captions[orderId] || undefined,
      });
      setUploadingFiles(current => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setCaptions(current => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    } catch (error) {
      toast.error(
        `حدث خطأ أثناء إرسال الملف: ${error instanceof Error ? error.message : error}`
      );
    } finally {
      setUploadingOrderId(null);
    }
  };

  const rows = useMemo(
    () =>
      orders.filter(order => {
        const term = search.trim().toLocaleLowerCase("ar");
        const matchesText =
          !term ||
          order.orderNumber.toLocaleLowerCase("ar").includes(term) ||
          order.customerName.toLocaleLowerCase("ar").includes(term) ||
          order.customerPhone.includes(term);
        const matchesProduct =
          productId === "all" ||
          order.items.some(item => String(item.productId) === productId);
        const uploadedToCarrier = Boolean(order.carrierTracking);
        const matchesTab =
          uploadedToCarrier &&
          (tab === "archive"
            ? finalStatuses.has(order.fulfillmentStatus)
            : !finalStatuses.has(order.fulfillmentStatus));
        return uploadedToCarrier && matchesText && matchesProduct && matchesTab;
      }),
    [orders, productId, search, tab]
  );
  const activeCount = orders.filter(
    order =>
      Boolean(order.carrierTracking) &&
      !finalStatuses.has(order.fulfillmentStatus)
  ).length;
  const archiveCount = orders.filter(
    order =>
      Boolean(order.carrierTracking) &&
      finalStatuses.has(order.fulfillmentStatus)
  ).length;

  const handleDeleteOne = (orderId: number, orderNumber: string) => {
    if (
      !window.confirm(
        `سيُحذف الطلب ${orderNumber} وبنوده نهائيًا. هل تريد المتابعة؟`
      )
    )
      return;
    deleteOne.mutate({ token, orderId });
  };
  const handleDeleteAll = () => {
    if (!rows.length) return;
    if (
      !window.confirm(
        `سيُحذف ${rows.length} طلبًا من تبويب "${tab === "active" ? "قيد الشحن" : "الأرشيف"}" نهائيًا. هل تريد المتابعة؟`
      )
    )
      return;
    deleteMany.mutate({ token, orderIds: rows.map(order => order.id) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[20px] border border-[#E7E9E2] bg-white p-3 shadow-soft md:grid-cols-[1fr_220px_auto]">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-[#F5F6F2] px-3 text-[#8A938D] transition-colors focus-within:bg-[var(--brand-soft)]">
          <Search className="size-4" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full bg-transparent text-sm text-[#1F2A25] outline-none placeholder:text-[#8A938D]"
            placeholder="ابحث برقم الطلب أو العميل"
          />
        </label>
        <select
          value={productId}
          onChange={event => setProductId(event.target.value)}
          className="h-11 rounded-xl border border-[#E3E1D8] bg-white px-3 text-xs font-extrabold text-[#1F2A25] outline-none transition-shadow focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10"
        >
          <option value="all">كل المنتجات</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => syncAll.mutate({ token })}
            disabled={syncAll.isPending}
            className="btn-press h-11 rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            <RefreshCw
              className={`ml-2 size-4 ${syncAll.isPending ? "animate-spin" : ""}`}
            />
            مزامنة الكل
          </Button>
          <Button
            variant="outline"
            onClick={() => setTab("active")}
            className={`btn-press h-11 rounded-xl transition-colors duration-200 ${
              tab === "active"
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                : "border-[#E3E1D8] text-[#79837D] hover:text-[#1F2A25]"
            }`}
          >
            <Truck className="ml-2 size-4" />
            قيد الشحن ({activeCount})
          </Button>
          <Button
            variant="outline"
            onClick={() => setTab("archive")}
            className={`btn-press h-11 rounded-xl transition-colors duration-200 ${
              tab === "archive"
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                : "border-[#E3E1D8] text-[#79837D] hover:text-[#1F2A25]"
            }`}
          >
            <Archive className="ml-2 size-4" />
            الأرشيف ({archiveCount})
          </Button>
          {tab === "archive" && fullAccess && (
            <Button
              variant="outline"
              onClick={handleDeleteAll}
              disabled={deleteMany.isPending || !rows.length}
              className="btn-press h-11 rounded-xl border-[#F3D2CB] text-[#A63D28] hover:bg-[#FCE8E4] hover:text-[#A63D28]"
            >
              <Trash2 className="ml-2 size-4" />
              حذف الكل ({rows.length})
            </Button>
          )}
        </div>
      </div>
      {rows.length ? (
        <div className="animate-fade-up overflow-hidden rounded-[20px] border border-[#E7E9E2] bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-right">
              <thead className="border-b border-[#EEF0E9] bg-[#FAF9F5] text-xs font-extrabold text-[#8A938D]">
                <tr>
                  <th className="px-5 py-4">الطلب</th>
                  <th className="px-5 py-4">المنتجات</th>
                  <th className="px-5 py-4">شركة الشحن</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4">آخر تحديث</th>
                  <th className="px-5 py-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(order => (
                  <tr
                    key={order.id}
                    className="border-b border-[#F1F2EC] transition-colors duration-200 last:border-0 hover:bg-[#FAF9F5]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-[var(--brand)]">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-xs text-[#8A938D]">
                        {order.customerName}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                        <Package className="size-4 text-[var(--brand)]" />
                        {order.items.map(item => item.title).join("، ")}
                      </p>
                      <p className="mt-1 text-xs text-[#8A938D]">
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}{" "}
                        قطعة
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-[#5C665F]">
                      {order.carrierStatus ? "Ecotrack" : "مرتبطة"}
                      <p className="mt-1 text-[11px] text-[#8A938D]">
                        {order.carrierTracking ?? "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${
                          order.fulfillmentStatus === "returned"
                            ? "bg-[#FCE8E4] text-[#A63D28]"
                            : order.fulfillmentStatus === "delivered"
                              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                              : "bg-[var(--warm-soft)] text-[var(--warm)]"
                        }`}
                      >
                        {carrierLabel(order.carrierStatus)}
                      </span>
                      <p className="mt-1 text-[11px] text-[#8A938D]">
                        حالة المتجر:{" "}
                        {orderStatusLabels[order.fulfillmentStatus] ??
                          order.fulfillmentStatus}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-[#79837D]">
                      {order.carrierStatusUpdatedAt
                        ? new Date(order.carrierStatusUpdatedAt).toLocaleString(
                            "ar-DZ"
                          )
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-2">
                        {order.carrierTracking &&
                        !finalStatuses.has(order.fulfillmentStatus) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sync.mutate({ token, orderId: order.id })}
                            disabled={
                              sync.isPending && sync.variables?.orderId === order.id
                            }
                            className="btn-press rounded-xl border-[var(--brand)]/30 text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                          >
                            <RefreshCw
                              className={`ml-2 size-3.5 ${sync.isPending && sync.variables?.orderId === order.id ? "animate-spin" : ""}`}
                            />
                            مزامنة
                          </Button>
                        ) : tab === "archive" && fullAccess ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDeleteOne(order.id, order.orderNumber)
                            }
                            disabled={deleteOne.isPending}
                            className="btn-press rounded-xl border-[#F3D2CB] text-[#A63D28] hover:bg-[#FCE8E4] hover:text-[#A63D28]"
                          >
                            <Trash2 className="ml-2 size-3.5" />
                            حذف
                          </Button>
                        ) : null}
                        {fullAccess && (
                          <div className="w-full max-w-xs">
                            <FileUpload
                              onFileSelect={file =>
                                handleFileSelect(order.id, file)
                              }
                              accept="image/*,video/*"
                              label="ارفع صورة أو فيديو"
                            />
                            {uploadingFiles[order.id] && (
                              <div className="mt-2">
                                <label className="mb-1 block text-xs font-extrabold text-[#46524C]">
                                  تعليق (اختياري)
                                </label>
                                <input
                                  type="text"
                                  value={captions[order.id] || ""}
                                  onChange={event =>
                                    handleCaptionChange(order.id, event.target.value)
                                  }
                                  placeholder="أضف تعليقًا على الوسائط..."
                                  className="h-8 w-full rounded-lg border border-[#E3E1D8] bg-white px-2 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)]"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendToWhatsApp(order.id)}
                                  disabled={
                                    sendMediaToWhatsApp.isPending &&
                                    uploadingOrderId === order.id
                                  }
                                  className="btn-press mt-2 w-full rounded-xl border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                                >
                                  {sendMediaToWhatsApp.isPending &&
                                  uploadingOrderId === order.id ? (
                                    <>
                                      <RefreshCw className="ml-2 size-3.5 animate-spin" />
                                      جاري الإرسال...
                                    </>
                                  ) : (
                                    "إرسال إلى واتساب"
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={tab === "archive" ? Archive : Truck}
          title={tab === "archive" ? "الأرشيف فارغ" : "لا توجد طلبات قيد الشحن"}
          description="ستظهر الطلبات هنا بعد رفعها إلى شركة الشحن أو بعد مزامنة حالتها."
          action={
            tab === "active" ? (
              <Button
                onClick={() => syncAll.mutate({ token })}
                disabled={syncAll.isPending}
                className="btn-press rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
              >
                <RefreshCw
                  className={`ml-2 size-4 ${syncAll.isPending ? "animate-spin" : ""}`}
                />
                مزامنة الكل
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
