import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck2,
  Loader2,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const formatPrice = (value: string | null | undefined, currency: string) =>
  value
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} ${currency}`
    : "—";
const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("ar-DZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function DigitalProducts() {
  const [, setLocation] = useLocation();
  const productsQuery = trpc.digital.products.useQuery();
  const ordersQuery = trpc.digital.orders.useQuery();
  const statsQuery = trpc.digital.stats.useQuery();
  const saveLinks = (result: {
    orderId: number;
    links: Array<{ url: string }>;
  }) =>
    setLinks(current => ({
      ...current,
      [result.orderId]: result.links.map(link => link.url),
    }));
  const confirmPayment = trpc.digital.confirmPayment.useMutation({
    onSuccess: result => {
      saveLinks(result);
      void ordersQuery.refetch();
      void statsQuery.refetch();
      result.emailStatus === "sent"
        ? toast.success("تم تأكيد الدفع وإرسال روابط التنزيل إلى بريد العميل.")
        : result.emailStatus === "failed"
          ? toast.warning(
              "تم تأكيد الدفع، لكن تعذر إرسال البريد. استخدم زر إعادة إنشاء الرابط وإعادة المحاولة."
            )
          : toast.success("تم تأكيد الدفع وإنشاء روابط التنزيل الآمنة.");
    },
    onError: error => toast.error(error.message || "تعذر إنشاء روابط التنزيل."),
  });
  const regenerateLinks = trpc.digital.regenerateLinks.useMutation({
    onSuccess: result => {
      saveLinks(result);
      void statsQuery.refetch();
      result.emailStatus === "sent"
        ? toast.success("تم إنشاء رابط جديد وإرساله إلى بريد العميل.")
        : result.emailStatus === "failed"
          ? toast.warning("تم إنشاء الرابط، لكن تعذر إرسال البريد.")
          : toast.success("تم إنشاء رابط تنزيل جديد بصلاحية مستقلة.");
    },
    onError: error => toast.error(error.message || "تعذر إعادة إنشاء الرابط."),
  });
  const [links, setLinks] = useState<Record<number, string[]>>({});
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const paidOrders = orders.filter(
    order => order.paymentStatus === "paid"
  ).length;
  const totalDownloads = statsQuery.data?.downloads ?? 0;

  return (
    <div dir="rtl">
      <PageIntro
        eyebrow="الكتالوج · التسليم الرقمي"
        title="المنتجات الرقمية"
        description="أدر الملفات التي تُباع عبر المتجر، راقب الطلبات الرقمية، وأنشئ روابط تنزيل محدودة بعد تأكيد الدفع."
        action={
          <Button
            onClick={() => setLocation("/products/create")}
            className="btn-press h-11 rounded-xl bg-[var(--brand)] font-extrabold shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
          >
            <FileArchive className="ml-2 size-4" />
            إضافة منتج رقمي
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "المنتجات الرقمية",
            value: products.length,
            icon: FileArchive,
            tone: "#0B5B43",
          },
          {
            label: "الطلبات الرقمية",
            value: orders.length,
            icon: PackageOpen,
            tone: "#182420",
          },
          {
            label: "طلبات مدفوعة",
            value: paidOrders,
            icon: CheckCircle2,
            tone: "#DE7C2A",
          },
          {
            label: "التنزيلات المسجلة",
            value: totalDownloads,
            icon: Download,
            tone: "#4A554F",
          },
        ].map(item => (
          <section
            key={item.label}
            className="rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft transition-shadow duration-200 hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <div
                className="grid size-10 place-items-center rounded-xl"
                style={{ backgroundColor: `${item.tone}14`, color: item.tone }}
              >
                <item.icon className="size-5" />
              </div>
              <span className="text-2xl font-extrabold text-[#1F2A25]">
                {item.value}
              </span>
            </div>
            <p className="mt-4 text-xs font-extrabold text-[#79837D]">
              {item.label}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#1F2A25]">
                كتالوج الملفات
              </h2>
              <p className="mt-1 text-xs text-[#8A938D]">
                الملفات الرقمية المحفوظة في متجرك.
              </p>
            </div>
            <FileCheck2 className="size-5 text-[var(--brand)]" />
          </div>
          {products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#D8DCD0] bg-[#FAFBF7] p-8 text-center text-sm leading-6 text-[#79837D]">
              لا توجد منتجات رقمية بعد. ابدأ بإضافة منتج وارفع ملفه.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {products.map(product => (
                <article
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#EDEFE8] bg-[#FAFBF7] p-3 transition-colors duration-200 hover:border-[#D9E5DD] hover:bg-white"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <FileArchive className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[#1F2A25]">
                      {product.title}
                    </p>
                    <p className="mt-1 text-xs text-[#8A938D]">
                      {product.digitalFileName ?? "ملف غير محدد"} ·{" "}
                      {product.digitalFileSize
                        ? `${(product.digitalFileSize / 1024 / 1024).toFixed(2)} MB`
                        : "—"}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-extrabold text-[var(--brand)]">
                      {formatPrice(product.price, product.currency)}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-[#8A938D]">
                      {product.digitalMaxDownloads ?? 0} تنزيلات / رابط
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#1F2A25]">
                الطلبات الرقمية
              </h2>
              <p className="mt-1 text-xs text-[#8A938D]">
                أكد الدفع يدويًا أو بعد ربط بوابة الدفع لإنشاء الرابط.
              </p>
            </div>
            <ShieldCheck className="size-5 text-[var(--brand)]" />
          </div>
          {orders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#D8DCD0] bg-[#FAFBF7] p-8 text-center text-sm leading-6 text-[#79837D]">
              ستظهر طلبات الملفات هنا بعد أول عملية شراء.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[640px] w-full text-right">
                <thead className="bg-[#F5F6F2] text-[11px] font-extrabold text-[#79837D]">
                  <tr>
                    <th className="rounded-r-xl px-3 py-3">الطلب</th>
                    <th className="px-3 py-3">العميل</th>
                    <th className="px-3 py-3">الإجمالي</th>
                    <th className="px-3 py-3">الدفع</th>
                    <th className="rounded-l-xl px-3 py-3">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr
                      key={order.id}
                      className="border-b border-[#EDEFE8] text-xs transition-colors duration-200 hover:bg-[#FAFBF7]"
                    >
                      <td className="px-3 py-4">
                        <p className="font-extrabold text-[#1F2A25]">
                          {order.orderNumber}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8A938D]">
                          {formatDate(order.createdAt)}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-bold text-[#4A554F]">
                          {order.customerName}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8A938D]">
                          {order.customerEmail ?? "بدون بريد"}
                        </p>
                      </td>
                      <td className="px-3 py-4 font-extrabold text-[var(--brand)]">
                        {formatPrice(order.total, order.currency)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${order.paymentStatus === "paid" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--warm-soft)] text-[var(--warm)]"}`}
                        >
                          {order.paymentStatus === "paid"
                            ? "مدفوع"
                            : "قيد الانتظار"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {order.paymentStatus === "paid" ? (
                          links[order.id]?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {links[order.id].map((url, index) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-soft)] px-2 py-1.5 text-[10px] font-extrabold text-[var(--brand)] transition-colors duration-200 hover:bg-[#DDEBE1]"
                                >
                                  <Download className="size-3" />
                                  رابط {index + 1}
                                </a>
                              ))}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={regenerateLinks.isPending}
                                onClick={() =>
                                  regenerateLinks.mutate({
                                    orderId: order.id,
                                    baseUrl: window.location.origin,
                                  })
                                }
                                className="btn-press h-8 rounded-lg border-[#E3E1D8] px-2 text-[10px] font-extrabold"
                              >
                                {regenerateLinks.isPending ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  "رابط جديد"
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={regenerateLinks.isPending}
                              onClick={() =>
                                regenerateLinks.mutate({
                                  orderId: order.id,
                                  baseUrl: window.location.origin,
                                })
                              }
                              className="btn-press h-8 rounded-lg border-[#E3E1D8] px-2 text-[10px] font-extrabold"
                            >
                              {regenerateLinks.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                "استعادة رابط التنزيل"
                              )}
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            disabled={confirmPayment.isPending}
                            onClick={() =>
                              confirmPayment.mutate({
                                orderId: order.id,
                                baseUrl: window.location.origin,
                              })
                            }
                            className="btn-press h-8 rounded-lg bg-[var(--brand)] px-3 text-[10px] font-extrabold shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
                          >
                            {confirmPayment.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "تأكيد الدفع وإنشاء الرابط"
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#D9E5DD] bg-[var(--brand-soft)] p-4 text-xs leading-6 text-[#47624F]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
        <p>
          يُخزن الملف خارج قاعدة البيانات، ويُحفظ الرمز بصيغة hash فقط. الرابط
          مؤقت وله حد تنزيل مستقل، ولا يُنشأ إلا بعد انتقال الطلب إلى «مدفوع».
        </p>
      </div>
    </div>
  );
}
