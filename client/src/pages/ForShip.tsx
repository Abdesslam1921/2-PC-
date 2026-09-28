import { useMemo, useState } from "react";
import {
  Archive,
  Package,
  RefreshCw,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";

const labels: Record<string, string> = {
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
type FulfillmentStatus =
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

export default function ForShip() {
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("all");
  // State for managing file uploads and sending
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Record<number, File>>({});
  const [captions, setCaptions] = useState<Record<number, string>>({});

  const ordersQuery = trpc.orders.list.useQuery();
  const productsQuery = trpc.products.list.useQuery();
  const utils = trpc.useUtils();

  // New mutation for sending media via WhatsApp
  const sendMediaToWhatsApp = trpc.delivery.sendMediaToWhatsApp.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الملف إلى واتساب بنجاح!");
      // Reset the upload state after successful send
      setUploadingOrderId(null);
      setUploadingFiles({});
      setCaptions({});
    },
    onError: (error) => {
      toast.error(`فشل إرسال الملف: ${error.message}`);
    }
  });

  const sync = trpc.delivery.syncEcotrackStatus.useMutation({
    onSuccess: async result => {
      toast.success(
        `تمت مزامنة الحالة: ${labels[result.fulfillmentStatus] ?? result.carrierStatus ?? "محدثة"}`
      );
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncAll = trpc.delivery.syncAllEcotrackStatuses.useMutation({
    onSuccess: async result => {
      toast.success(
        `تمت المزامنة: ${result.synced} طلبًا · ${result.delivered} تم التسليم · ${result.returned} مرتجع · ${result.cancelled} ملغى.`
      );
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  /** Manual status edit from ProShip (hybrid sync: wins until the next sync). */
  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث حالة الطلب يدويًا.");
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteArchived = trpc.orders.deleteArchived.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الطلب من الأرشيف نهائيًا.");
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteOne = trpc.orders.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الطلب.");
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteMany = trpc.orders.deleteMany.useMutation({
    onSuccess: async result => {
      toast.success(`تم حذف ${result.deleted} طلبًا من المتابعة.`);
      await utils.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const allOrders = ordersQuery.data ?? [];
  const rows = useMemo(
    () =>
      allOrders.filter(order => {
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
    [allOrders, productId, search, tab]
  );
  const activeCount = allOrders.filter(
    order =>
      Boolean(order.carrierTracking) &&
      !finalStatuses.has(order.fulfillmentStatus)
  ).length;
  const archiveCount = allOrders.filter(
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
    deleteOne.mutate({ orderId });
  };
  const handleDeleteAll = () => {
    if (!rows.length) return;
    if (
      !window.confirm(
        `سيُحذف ${rows.length} طلبًا من تبويب "${tab === "active" ? "قيد الشحن" : "الأرشيف"}" نهائيًا. هل تريد المتابعة؟`
      )
    )
      return;
    deleteMany.mutate({ orderIds: rows.map(order => order.id) });
  };

  const handleFileSelect = (orderId: number, file: File) => {
    setUploadingFiles(prev => ({
      ...prev,
      [orderId]: file
    }));
  };

  const handleCaptionChange = (orderId: number, caption: string) => {
    setCaptions(prev => ({
      ...prev,
      [orderId]: caption
    }));
  };

  const handleSendToWhatsApp = async (orderId: number) => {
    const file = uploadingFiles[orderId];
    if (!file) {
      toast.error("يرجى اختيار ملف للإرسال");
      return;
    }

    setUploadingOrderId(orderId);

    try {
      // Get the session token from cookies
      const cookies = document.cookie
        .split('; ')
        .reduce((acc, cookie) => {
          const [name, value] = cookie.split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
      
      const token = cookies['app_session_id'];
      
      if (!token) {
        throw new Error("لم يتم العثور على جلسة مستخدم");
      }

      // Upload the file to the server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId.toString());
      
      const uploadResponse = await fetch('/api/upload-whatsapp-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "فشل رفع الملف");
      }
      
      const uploadResult = await uploadResponse.json();
      
      // Then call the backend to send to WhatsApp
      await sendMediaToWhatsApp.mutateAsync({
        orderId,
        mediaUrl: uploadResult.url,
        caption: captions[orderId] || undefined
      });
    } catch (error) {
      console.error("Error sending to WhatsApp:", error);
      toast.error(`حدث خطأ أثناء إرسال الملف: ${(error as Error).message}`);
    } finally {
      setUploadingOrderId(null);
    }
  };

  return (
    <div dir="rtl">
      <PageIntro
        eyebrow="التشغيل والشحن"
        title="ProShip"
        description="تتبع الطلبات لدى شركة الشحن بكل حالاتها، مع إبقاء كوموند ليفري وكوموند روتور منفصلتين لحساب الربح الحقيقي."
        action={
          <div className="flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-4 py-2 text-xs font-extrabold text-[var(--brand)]">
            <span className="size-2 rounded-full bg-[var(--brand)]" />
            {activeCount} قيد المتابعة
          </div>
        }
      />
      <div className="mb-5 grid gap-3 rounded-[20px] border border-[#E7E9E2] bg-white p-3 shadow-soft md:grid-cols-[1fr_220px_auto_auto]">
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
          className="h-11 rounded-xl border border-[#E3E1D8] bg-white px-3 text-xs font-extrabold text-[#1F2A25] outline-none transition-shadow focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
        >
          <option value="all">كل المنتجات</option>
          {(productsQuery.data ?? [])
            .filter((product): product is NonNullable<typeof product> =>
              Boolean(product)
            )
            .map(product => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
        </select>
        <div className="flex gap-2">
          <Button
            onClick={() => syncAll.mutate()}
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
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
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
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                : "border-[#E3E1D8] text-[#79837D] hover:text-[#1F2A25]"
            }`}
          >
            <Archive className="ml-2 size-4" />
            الأرشيف ({archiveCount})
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleDeleteAll}
          disabled={deleteMany.isPending || !rows.length}
          className="btn-press h-11 rounded-xl border-[#F3D2CB] text-[#A63D28] hover:bg-[#FCE8E4] hover:text-[#A63D28]"
        >
          <Trash2
            className={`ml-2 size-4 ${deleteMany.isPending ? "animate-spin" : ""}`}
          />
          حذف الكل ({rows.length})
        </Button>
      </div>
      {rows.length ? (
        <div className="animate-fade-up overflow-hidden rounded-[20px] border border-[#E7E9E2] bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-right">
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
                      {order.carrierStatus
                        ? "Ecotrack"
                        : order.carrierTracking
                          ? "مرتبطة"
                          : "لم تُرفع بعد"}
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
                      <select
                        aria-label={`تعديل حالة الطلب ${order.orderNumber}`}
                        value={order.fulfillmentStatus}
                        onChange={event =>
                          updateStatus.mutate({
                            orderId: order.id,
                            fulfillmentStatus: event.target
                              .value as FulfillmentStatus,
                          })
                        }
                        disabled={
                          updateStatus.isPending &&
                          updateStatus.variables?.orderId === order.id
                        }
                        className="mt-2 h-9 w-full min-w-[150px] rounded-xl border border-[#E3E1D8] bg-white px-2 text-xs font-extrabold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 disabled:opacity-50"
                      >
                        {Object.entries(labels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-[#8A938D]">
                        حالة الشركة: {carrierLabel(order.carrierStatus)}
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
                          !finalStatuses.has(order.fulfillmentStatus) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sync.mutate({ orderId: order.id })}
                              disabled={
                                sync.isPending &&
                                sync.variables?.orderId === order.id
                              }
                              className="btn-press rounded-xl border-[var(--brand)]/30 text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                            >
                              <RefreshCw
                                className={`ml-2 size-3.5 ${sync.isPending && sync.variables?.orderId === order.id ? "animate-spin" : ""}`}
                              />
                              مزامنة
                            </Button>
                          )}
                        {tab === "archive" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDeleteOne(order.id, order.orderNumber)
                            }
                            disabled={
                              deleteOne.isPending || deleteArchived.isPending
                            }
                            className="btn-press rounded-xl border-[#F3D2CB] text-[#A63D28] hover:bg-[#FCE8E4] hover:text-[#A63D28]"
                          >
                            <Trash2 className="ml-2 size-3.5" />
                            حذف
                          </Button>
                        )}
                        
                        {/* File Upload Section */}
                        <div className="w-full max-w-xs">
                          <FileUpload
                            onFileSelect={(file) => handleFileSelect(order.id, file)}
                            accept="image/*,video/*"
                            label="ارفع صورة أو فيديو"
                          />
                          
                          {uploadingFiles[order.id] && (
                            <div className="mt-2">
                              <label className="block text-xs font-extrabold text-[#46524C] mb-1">
                                تعليق (اختياري)
                              </label>
                              <input
                                type="text"
                                value={captions[order.id] || ""}
                                onChange={(e) => handleCaptionChange(order.id, e.target.value)}
                                placeholder="أضف تعليقًا على الوسائط..."
                                className="w-full h-8 rounded-lg border border-[#E3E1D8] bg-white px-2 text-xs text-[#1F2A25] outline-none transition focus:border-[var(--brand)]"
                              />
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendToWhatsApp(order.id)}
                                disabled={sendMediaToWhatsApp.isPending && uploadingOrderId === order.id}
                                className="mt-2 btn-press rounded-xl border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] w-full"
                              >
                                {sendMediaToWhatsApp.isPending && uploadingOrderId === order.id ? (
                                  <>
                                    <RefreshCw className="ml-2 size-3.5 animate-spin" />
                                    جاري الإرسال...
                                  </>
                                ) : (
                                  <>
                                    إرسال إلى واتساب
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
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
                onClick={() => syncAll.mutate()}
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
