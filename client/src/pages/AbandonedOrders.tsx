import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Loader2, Phone, UserRound } from "lucide-react";

export default function AbandonedOrders() {
  const query = trpc.orders.abandonedList.useQuery();
  return (
    <div dir="rtl">
      <PageIntro
        eyebrow="التشغيل"
        title="الطلبات المتروكة"
        description="عملاء بدأوا تعبئة نموذج الطلب ولم يكملوا التسجيل."
        action={
          <div className="rounded-xl bg-[var(--warm-soft)] px-4 py-2 text-xs font-extrabold text-[#A8641F]">
            {query.data?.length ?? 0} مفتوح
          </div>
        }
      />
      {query.isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
        </div>
      ) : query.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map(item => (
            <article
              key={item.id}
              className="animate-fade-up rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
                  <ClipboardList className="size-5" />
                </div>
                <span className="rounded-full bg-[#A63D28] px-3 py-1 text-[11px] font-black text-white">
                  متروك
                </span>
              </div>
              <p className="mt-5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#8A938D]">
                <Phone className="size-3.5" />
                رقم الهاتف
              </p>
              <a
                href={item.customerPhone ? `tel:${item.customerPhone}` : undefined}
                dir="ltr"
                className="mt-1 block text-2xl font-black tracking-wide text-[var(--brand)] transition hover:text-[var(--brand-strong)]"
              >
                {item.customerPhone || "—"}
              </a>
              <p className="mt-3 flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                <UserRound className="size-4 text-[#8A938D]" />
                {item.customerName || "عميل بدون اسم"}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#F7F8F3] p-3">
                  <dt className="text-[#8A938D]">الولاية</dt>
                  <dd className="mt-1 font-extrabold text-[#1F2A25]">
                    {item.wilaya || "غير محددة"}
                  </dd>
                </div>
                <div className="rounded-xl bg-[#F7F8F3] p-3">
                  <dt className="text-[#8A938D]">الكمية</dt>
                  <dd className="mt-1 font-extrabold text-[#1F2A25]">
                    {item.quantity}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-[#A8AFA9]">
                آخر نشاط: {new Date(item.updatedAt).toLocaleString("ar-DZ")}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد طلبات متروكة"
          description="ستظهر هنا البيانات التي بدأ العميل بإدخالها ولم يكمل الطلب."
          action={
            <Button
              variant="outline"
              className="rounded-xl border-[#E3E1D8] bg-white px-5 font-bold text-[#4A5A52]"
            >
              البيانات تُحفظ تلقائيًا
            </Button>
          }
        />
      )}
    </div>
  );
}
