import { PageIntro, PresentationNotice } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { storeConfig } from "@/config/store";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const money = (value: string) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} دج`;

const cardClass =
  "rounded-[22px] border border-[#E7E9E2] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift";

export default function Home() {
  const [, setLocation] = useLocation();
  const statsQuery = trpc.dashboard.stats.useQuery();
  const stats = statsQuery.data;
  const sharkAnalytics = trpc.sharkCod.analytics.useQuery();
  const summaryCards = [
    {
      label: "مبيعات هذا الشهر",
      value: money(stats?.salesThisMonth ?? "0"),
      hint: stats ? "من الطلبات غير الملغاة" : "جارٍ تحميل البيانات",
      icon: CircleDollarSign,
      tint: "bg-[var(--brand-soft)]",
      iconTint: "text-[var(--brand)]",
    },
    {
      label: "الطلبات",
      value: String(stats?.ordersCount ?? 0),
      hint: stats?.ordersCount ? "طلب محفوظ" : "لا توجد طلبات جديدة",
      icon: ClipboardList,
      tint: "bg-[#EAF4FB]",
      iconTint: "text-[#2E7EA6]",
    },
    {
      label: "العملاء",
      value: String(stats?.customersCount ?? 0),
      hint: stats?.customersCount ? "عميل بحسب الهاتف" : "سيظهر العملاء هنا",
      icon: Users,
      tint: "bg-[var(--warm-soft)]",
      iconTint: "text-[var(--warm)]",
    },
    {
      label: "المنتجات المنشورة",
      value: String(stats?.publishedProducts ?? 0),
      hint: stats?.publishedProducts
        ? "منتج متاح للواجهة"
        : "الكتالوج فارغ الآن",
      icon: Package,
      tint: "bg-[#FCE8E4]",
      iconTint: "text-[#C0492F]",
    },
  ];
  const chart = stats?.salesByDay ?? [];
  const maxChart = Math.max(...chart.map(day => Number(day.value)), 1);
  return (
    <div>
      <PageIntro
        eyebrow="مرحبًا بك"
        title={`لوحة ${storeConfig.name}`}
        description="هذه المؤشرات تُقرأ مباشرة من كتالوجك وطلباتك المحفوظة."
        action={
          <Button
            onClick={() => setLocation("/products")}
            className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-bold text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            <Plus className="ml-2 size-4" />
            إضافة منتج
          </Button>
        }
      />
      <PresentationNotice />
      {statsQuery.isLoading ? (
        <div className="grid min-h-40 place-items-center">
          <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {summaryCards.map(card => {
              const Icon = card.icon;
              return (
                <article key={card.label} className={cardClass}>
                  <div className="flex items-start justify-between">
                    <div
                      className={`grid size-10 place-items-center rounded-xl ${card.tint} ${card.iconTint}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="rounded-full bg-[#F5F6F2] px-2.5 py-1 text-[10px] font-bold text-[#9AA49E]">
                      هذا الشهر
                    </span>
                  </div>
                  <p className="mt-5 text-xs font-bold text-[#79837D]">
                    {card.label}
                  </p>
                  <p className="mt-1.5 text-[26px] font-extrabold tracking-[-0.03em] text-[#1F2A25]">
                    {card.value}
                  </p>
                  <p className="mt-2 text-[11px] text-[#9AA49E]">{card.hint}</p>
                </article>
              );
            })}
          </section>
          <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.8fr)]">
            <article className={`${cardClass} sm:p-6`}>
              <div>
                <h2 className="text-base font-extrabold text-[#1F2A25]">
                  أداء المبيعات
                </h2>
                <p className="mt-1 text-xs text-[#8A938D]">
                  آخر 7 أيام · بيانات حقيقية
                </p>
              </div>
              <div className="mt-8 h-52 rounded-2xl bg-[#F7F8F4] p-5">
                <div className="flex h-full items-end justify-between gap-2 border-b border-dashed border-[#E2E5DC] pb-1">
                  {chart.map(day => (
                    <div
                      key={day.date}
                      className="flex h-full flex-1 flex-col justify-end"
                    >
                      <div
                        title={`${money(day.value)}`}
                        style={{
                          height: `${Math.max(4, (Number(day.value) / maxChart) * 100)}%`,
                        }}
                        className="rounded-t-lg bg-gradient-to-t from-[var(--brand)] to-[#A9CDBD] transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[10px] font-bold text-[#A7AFA9]">
                  {chart.map(day => (
                    <span key={day.date}>
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString(
                        "ar-DZ",
                        { weekday: "short" }
                      )}
                    </span>
                  ))}
                </div>
              </div>
              {!chart.some(day => Number(day.value) > 0) && (
                <div className="mt-4 rounded-xl bg-[#F2F4EF] px-3 py-2.5 text-xs text-[#66716B]">
                  سيظهر منحنى المبيعات هنا بعد تسجيل الطلبات.
                </div>
              )}
            </article>
            <article className={`${cardClass} sm:p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#1F2A25]">
                    ابدأ من هنا
                  </h2>
                  <p className="mt-1 text-xs text-[#8A938D]">
                    خطوات تشغيل المتجر
                  </p>
                </div>
                <div className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <ShoppingBag className="size-5" />
                </div>
              </div>
              <div className="mt-6 space-y-1">
                {[
                  {
                    number: "01",
                    title: "أضف أول منتج",
                    text: "أنشئ الكتالوج والأسعار والصور.",
                    path: "/products",
                  },
                  {
                    number: "02",
                    title: "اضبط التوصيل",
                    text: "حدد رسوم المكتب والمنزل.",
                    path: "/delivery",
                  },
                  {
                    number: "03",
                    title: "أنشئ فانل",
                    text: "اربط صفحة الهبوط بالطلب.",
                    path: "/funnels",
                  },
                ].map(step => (
                  <button
                    key={step.number}
                    onClick={() => setLocation(step.path)}
                    className="group flex w-full items-center gap-3 rounded-2xl p-3 text-right transition hover:bg-[#F6F8F4]"
                  >
                    <span className="text-xs font-extrabold text-[#A9CDBD]">
                      {step.number}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-extrabold text-[#2E3833]">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-[11px] text-[#8A938D]">
                        {step.text}
                      </span>
                    </span>
                    <ChevronLeft className="size-4 text-[#BFC7C0] transition group-hover:-translate-x-0.5 group-hover:text-[var(--brand)]" />
                  </button>
                ))}
              </div>
            </article>
          </section>
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <article className={`${cardClass} sm:p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#1F2A25]">
                    أحدث الطلبات
                  </h2>
                  <p className="mt-1 text-xs text-[#8A938D]">
                    آخر الطلبات من قاعدة البيانات
                  </p>
                </div>
                <button
                  onClick={() => setLocation("/orders")}
                  className="text-xs font-extrabold text-[var(--brand)]"
                >
                  عرض الكل
                </button>
              </div>
              {stats?.recentOrders?.length ? (
                <div className="mt-5 space-y-2">
                  {stats.recentOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => setLocation("/orders")}
                      className="flex w-full items-center justify-between rounded-xl bg-[#F7F8F4] p-3 text-right transition hover:bg-[#F0F3EC]"
                    >
                      <span>
                        <span className="block text-sm font-extrabold text-[#2E3833]">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-[#9AA49E]">
                          {order.orderNumber}
                        </span>
                      </span>
                      <span className="text-sm font-extrabold text-[var(--brand-strong)]">
                        {money(order.total)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDE1D5] bg-[#F9FAF6] px-5 text-center">
                  <p className="text-sm font-extrabold text-[#5D6862]">
                    لا توجد طلبات حتى الآن
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#9AA49E]">
                    عند وصول أول طلب ستجد تفاصيله وحالته هنا.
                  </p>
                </div>
              )}
            </article>
            <article className={`${cardClass} sm:p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#1F2A25]">
                    الطلبات المتروكة
                  </h2>
                  <p className="mt-1 text-xs text-[#8A938D]">
                    بدأوا تعبئة النموذج ولم يكملوا
                  </p>
                </div>
                <button
                  onClick={() => setLocation("/abandoned-orders")}
                  className="text-xs font-extrabold text-[var(--brand)]"
                >
                  عرض الكل
                </button>
              </div>
              <div className="mt-5 rounded-2xl bg-[var(--warm-soft)] p-4">
                <p className="text-2xl font-extrabold text-[#1F2A25]">
                  {stats?.abandonedCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-[#8A7B66]">
                  طلبًا مفتوحًا يحتاج متابعة
                </p>
              </div>
            </article>
          </section>
        </>
      )}
      <button
        onClick={() => {
          setLocation("/products");
          toast.info("افتح المنتجات لإضافة عنصر جديد.");
        }}
        className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand)] transition hover:gap-3"
      >
        ابدأ بإضافة منتجاتك
        <ArrowLeft className="size-4" />
      </button>
    </div>
  );
}
