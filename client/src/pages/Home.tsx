import { Button } from "@/components/ui/button";
import { PresentationNotice } from "@/components/PageIntro";
import { storeConfig } from "@/config/store";
import { trpc } from "@/lib/trpc";
import mascotUrl from "@/assets/mascot.svg";
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
import type { CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const money = (value: string) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} دج`;

const cardBars = [
  ["30%", "55%", "40%", "72%", "50%", "88%"],
  ["45%", "28%", "62%", "48%", "80%", "58%"],
  ["38%", "60%", "46%", "70%", "52%", "84%"],
  ["52%", "34%", "66%", "44%", "76%", "60%"],
];

function greetingWord() {
  return new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const statsQuery = trpc.dashboard.stats.useQuery();
  const stats = statsQuery.data;
  trpc.sharkCod.analytics.useQuery();
  const activeStoreQuery = trpc.stores.active.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const storeLabel =
    (activeStoreQuery.data as { name?: string } | undefined)?.name?.trim() ||
    storeConfig.name;

  const summaryCards = [
    {
      label: "مبيعات هذا الشهر",
      value: money(stats?.salesThisMonth ?? "0"),
      hint: stats ? "من الطلبات غير الملغاة" : "جارٍ تحميل البيانات",
      icon: CircleDollarSign,
    },
    {
      label: "الطلبات",
      value: String(stats?.ordersCount ?? 0),
      hint: stats?.ordersCount ? "طلب محفوظ" : "لا توجد طلبات جديدة",
      icon: ClipboardList,
    },
    {
      label: "العملاء",
      value: String(stats?.customersCount ?? 0),
      hint: stats?.customersCount ? "عميل بحسب الهاتف" : "سيظهر العملاء هنا",
      icon: Users,
    },
    {
      label: "المنتجات المنشورة",
      value: String(stats?.publishedProducts ?? 0),
      hint: stats?.publishedProducts
        ? "منتج متاح للواجهة"
        : "الكتالوج فارغ الآن",
      icon: Package,
    },
  ];
  const chart = stats?.salesByDay ?? [];
  const maxChart = Math.max(...chart.map(day => Number(day.value)), 1);

  return (
    <div className="home-scope">
      <div className="home-aurora" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>

      <section className="animate-fade-up text-center">
        <h1 className="bg-[linear-gradient(100deg,#0C2A26_35%,#0F766E_75%)] bg-clip-text text-[30px] font-black leading-[1.35] tracking-[-0.02em] text-transparent sm:text-[34px]">
          نظرة عامة على الحساب
        </h1>
        <p className="mt-4 inline-flex items-center gap-2 text-xl font-bold text-[#0C2A26]">
          <span>
            {greetingWord()} {storeLabel}
          </span>
          <svg
            className="home-wave size-6 text-[#B45309]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4" />
            <path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10" />
            <path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V11" />
            <path d="M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2.5a1.5 1.5 0 0 1 2.6-1" />
          </svg>
        </p>
        <p className="mt-6 flex items-center justify-start gap-2 text-sm font-semibold text-[#576B66]">
          <span className="home-live-dot" aria-hidden="true" />
          تحقق مما يحدث
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => setLocation("/products")}
            className="h-11 rounded-full bg-[linear-gradient(135deg,#0F766E,#0B5D57)] px-6 font-bold text-white shadow-cta hover:brightness-105"
          >
            <Plus className="ml-2 size-4" />
            إضافة منتج
          </Button>
          <button
            onClick={() => setLocation("/templates")}
            className="h-11 rounded-full border border-[rgba(15,118,110,0.24)] bg-white/70 px-5 text-sm font-extrabold text-[#0F766E] backdrop-blur transition hover:bg-white"
          >
            القوالب
          </button>
        </div>
      </section>

      <div className="mt-7">
        <PresentationNotice />
      </div>

      {statsQuery.isLoading ? (
        <div className="grid min-h-40 place-items-center">
          <Loader2 className="size-7 animate-spin text-[#0F766E]" />
        </div>
      ) : (
        <>
          <section className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
            {summaryCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="home-card p-6">
                  <div className="home-card-glow" aria-hidden="true" />
                  <div className="relative z-[1] flex items-start justify-between gap-4">
                    <div className="home-icon-chip">
                      <Icon className="size-6" />
                    </div>
                    <div className="home-mini-bars" aria-hidden="true">
                      {cardBars[index % cardBars.length].map((height, barIndex) => (
                        <i
                          key={barIndex}
                          style={{ "--h": height } as CSSProperties}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="relative z-[1] mt-5 text-sm font-bold text-[#576B66]">
                    {card.label}
                  </p>
                  <p className="relative z-[1] mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0C2A26]">
                    {card.value}
                  </p>
                  <p className="relative z-[1] mt-2 text-xs text-[#576B66]">
                    {card.hint}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="home-card relative mt-5 overflow-hidden p-6 sm:p-7">
            <div className="home-card-glow" aria-hidden="true" />
            <div className="home-float pointer-events-none absolute -bottom-3 right-2 size-[104px] sm:right-5">
              <img src={mascotUrl} alt="" className="size-full object-contain" />
            </div>
            <div className="relative z-[1] max-w-[68%] sm:max-w-[62%]">
              <h3 className="text-xl font-black leading-8 text-[#0C2A26]">
                طوّر واجهة متجرك بلمسة جاهزة
              </h3>
              <p className="mt-2 text-sm font-medium leading-7 text-[#576B66]">
                اختر قالبًا، خصّص الألوان، وعاين النتيجة قبل النشر — من دون أي
                تأثير على لوحة التحكم.
              </p>
              <button
                onClick={() => setLocation("/templates")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0F766E,#0B5D57)] px-5 py-2.5 text-sm font-extrabold text-white shadow-cta transition hover:brightness-105"
              >
                فتح القوالب
                <ArrowLeft className="size-4" />
              </button>
            </div>
          </section>

          <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.8fr)]">
            <article className="home-card p-6">
              <div className="relative z-[1]">
                <h2 className="text-base font-black text-[#0C2A26]">
                  أداء المبيعات
                </h2>
                <p className="mt-1 text-xs text-[#576B66]">
                  آخر 7 أيام · بيانات حقيقية
                </p>
              </div>
              <div className="relative z-[1] mt-7 h-52 rounded-2xl bg-white/70 p-5">
                <div className="flex h-full items-end justify-between gap-2 border-b border-dashed border-[rgba(15,118,110,0.2)] pb-1">
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
                        className="rounded-t-lg bg-gradient-to-t from-[#0F766E] to-[#5EEAD4] transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[10px] font-bold text-[#576B66]">
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
                <div className="relative z-[1] mt-4 rounded-xl bg-white/70 px-3 py-2.5 text-xs text-[#576B66]">
                  سيظهر منحنى المبيعات هنا بعد تسجيل الطلبات.
                </div>
              )}
            </article>

            <article className="home-card p-6">
              <div className="relative z-[1] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-[#0C2A26]">
                    ابدأ من هنا
                  </h2>
                  <p className="mt-1 text-xs text-[#576B66]">
                    خطوات تشغيل المتجر
                  </p>
                </div>
                <div className="home-icon-chip size-11">
                  <ShoppingBag className="size-5" />
                </div>
              </div>
              <div className="relative z-[1] mt-5 space-y-1">
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
                    className="group flex w-full items-center gap-3 rounded-2xl p-3 text-right transition hover:bg-white/70"
                  >
                    <span className="text-xs font-black text-[#14B8A6]">
                      {step.number}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-black text-[#1F2A25]">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-[11px] text-[#576B66]">
                        {step.text}
                      </span>
                    </span>
                    <ChevronLeft className="size-4 text-[#BFC7C0] transition group-hover:-translate-x-0.5 group-hover:text-[#0F766E]" />
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <article className="home-card p-6">
              <div className="relative z-[1] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-[#0C2A26]">
                    أحدث الطلبات
                  </h2>
                  <p className="mt-1 text-xs text-[#576B66]">
                    آخر الطلبات من قاعدة البيانات
                  </p>
                </div>
                <button
                  onClick={() => setLocation("/orders")}
                  className="text-xs font-black text-[#0F766E]"
                >
                  عرض الكل
                </button>
              </div>
              {stats?.recentOrders?.length ? (
                <div className="relative z-[1] mt-5 space-y-2">
                  {stats.recentOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => setLocation("/orders")}
                      className="flex w-full items-center justify-between rounded-xl bg-white/70 p-3 text-right transition hover:bg-white"
                    >
                      <span>
                        <span className="block text-sm font-black text-[#1F2A25]">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-[#576B66]">
                          {order.orderNumber}
                        </span>
                      </span>
                      <span className="text-sm font-black text-[#0B5D57]">
                        {money(order.total)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="relative z-[1] mt-5 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(15,118,110,0.24)] bg-white/60 px-5 text-center">
                  <p className="text-sm font-black text-[#0C2A26]">
                    لا توجد طلبات حتى الآن
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#576B66]">
                    عند وصول أول طلب ستجد تفاصيله وحالته هنا.
                  </p>
                </div>
              )}
            </article>

            <article className="home-card p-6">
              <div className="relative z-[1] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-[#0C2A26]">
                    الطلبات المتروكة
                  </h2>
                  <p className="mt-1 text-xs text-[#576B66]">
                    بدأوا تعبئة النموذج ولم يكملوا
                  </p>
                </div>
                <button
                  onClick={() => setLocation("/abandoned-orders")}
                  className="text-xs font-black text-[#0F766E]"
                >
                  عرض الكل
                </button>
              </div>
              <div className="relative z-[1] mt-5 rounded-2xl bg-white/70 p-4">
                <p className="text-2xl font-black text-[#0C2A26]">
                  {stats?.abandonedCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-[#576B66]">
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
        className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#0F766E] transition hover:gap-3"
      >
        ابدأ بإضافة منتجاتك
        <ArrowLeft className="size-4" />
      </button>

      <footer className="mt-9 text-center">
        <svg
          className="mx-auto block h-8 w-[74%] opacity-90"
          viewBox="0 0 640 40"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="homeSigFade" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f5b13d" />
              <stop offset="0.5" stopColor="#14b8a6" />
              <stop offset="1" stopColor="#f5b13d" />
            </linearGradient>
          </defs>
          <path
            d="M8 28 C 90 6, 170 34, 250 20 C 330 6, 380 34, 452 20 C 512 8, 560 30, 632 16"
            stroke="url(#homeSigFade)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="home-signature -mt-1 text-3xl text-[#0F766E]">
          {storeLabel}
        </p>
        <p className="mt-1 text-[11px] font-bold tracking-[0.2em] text-[#576B66]">
          لوحة تحكم المتجر
        </p>
      </footer>
    </div>
  );
}
