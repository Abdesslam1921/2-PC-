import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Beaker,
  Eye,
  FileUp,
  History,
  LayoutTemplate,
  Plus,
  Sparkles,
  TrendingUp,
  Trophy,
  Wand2,
} from "lucide-react";
import { useLocation } from "wouter";

function FunnelPathCard({
  title,
  description,
  icon: Icon,
  primary,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof Wand2;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:border-[#CFDED3] hover:shadow-lift">
      <div
        className={`relative grid h-52 place-items-center overflow-hidden ${
          primary
            ? "bg-[radial-gradient(circle_at_18%_15%,#CBE5D7_0,transparent_30%),radial-gradient(circle_at_85%_20%,#F6E4C9_0,transparent_34%),linear-gradient(135deg,#EEF6F1,#FAF5EB)]"
            : "bg-[radial-gradient(circle_at_15%_10%,#D8EAE0_0,transparent_32%),linear-gradient(135deg,#F5F8F3,#EDF4EF)]"
        }`}
      >
        <div
          className={`absolute top-0 rounded-b-xl px-5 py-1.5 text-[10px] font-bold tracking-[0.08em] text-white ${primary ? "bg-[var(--brand)]" : "bg-[#1F2A25]"}`}
        >
          {primary ? "AI FUNNEL STUDIO" : "IMPORT YOUR DESIGN"}
        </div>
        <div
          className={`grid size-24 place-items-center rounded-[28px] border-4 border-white/80 shadow-[0_14px_28px_rgba(11,61,45,0.16)] ${primary ? "bg-[var(--brand)] text-[#F3D9AE]" : "bg-white text-[var(--brand)]"}`}
        >
          <Icon className="size-10" />
        </div>
        <span
          className={`absolute bottom-4 rounded-full px-3 py-1 text-[11px] font-bold ${primary ? "bg-white/85 text-[var(--brand-strong)]" : "bg-[var(--brand-soft)] text-[var(--brand)]"}`}
        >
          {primary ? "نسخة + مشاهد إبداعية" : "تصميم + نموذج طلب"}
        </span>
      </div>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.025em] text-[#1F2A25]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#79837D]">
              {description}
            </p>
          </div>
        </div>
        <button
          onClick={onClick}
          className={`btn-press mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold ${
            primary
              ? "bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
              : "border border-[#E3E1D8] bg-white text-[#2E3A33] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
          }`}
        >
          ابدأ الآن <ArrowLeft className="size-4" />
        </button>
      </div>
    </article>
  );
}

function statusLabel(status: string) {
  if (status === "ready")
    return {
      label: "جاهزة للمراجعة",
      classes: "bg-[var(--brand-soft)] text-[var(--brand)]",
    };
  if (status === "generating")
    return {
      label: "جارٍ التوليد",
      classes: "bg-[var(--warm-soft)] text-[#A35A16]",
    };
  return { label: "تحتاج مراجعة", classes: "bg-[#FCE8E4] text-[#A63D28]" };
}

function AbTestingCard({ onClick }: { onClick: () => void }) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:border-[#CFDED3] hover:shadow-lift">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,#F6E4C9_0,transparent_32%),linear-gradient(135deg,#084534,#0B5B43)] p-6 text-white sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid size-16 shrink-0 place-items-center rounded-[20px] border-4 border-white/15 bg-white/10 text-[#F3D9AE]">
            <Beaker className="size-8" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[.18em] text-[#F2D9B8]">
              AI A/B TESTING
            </p>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.025em]">
              اختبار A/B بالذكاء الاصطناعي
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              ينشئ الذكاء الاصطناعي متغيرات مختلفة — «اطلب الآن» و«احصل عليه
              غدًا» و«الدفع عند الاستلام 🇩🇿» — تجرّبها المنصة ثم توجّه الزيارات
              تلقائيًا للفائز أو تختاره بنفسك.
            </p>
          </div>
          <button
            onClick={onClick}
            className="btn-press mt-1 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F3D9AE] px-6 text-sm font-extrabold text-[#1F2A25] shadow-cta hover:bg-white sm:mr-auto"
          >
            جرّب الاختبار <ArrowLeft className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 text-xs font-bold text-[#41564B]">
        <span className="flex items-center gap-2">
          <Beaker className="size-4 text-[var(--brand)]" />
          متغيرات متعددة بزوايا بيع مختلفة
        </span>
        <span className="flex items-center gap-2">
          <TrendingUp className="size-4 text-[var(--brand)]" />
          نسب تحويل حقيقية لكل متغير
        </span>
        <span className="flex items-center gap-2">
          <Trophy className="size-4 text-[var(--brand)]" />
          توجيه تلقائي للفائز
        </span>
      </div>
    </article>
  );
}

export default function Funnels() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const isCreateFlow = location === "/funnels/create";
  const historyQuery = trpc.landings.list.useQuery(undefined, {
    enabled: isAuthenticated && !isCreateFlow,
  });

  if (isCreateFlow)
    return (
      <div className="mx-auto w-full max-w-5xl pb-10">
        <PageIntro
          eyebrow="الفانل"
          title="أنشئ فانل جديد"
          description="اختر كيف تريد البدء: صفحة هبوط ذكية من منتجك الحقيقي، أو تصميمك الخاص."
          action={
            <Button
              variant="outline"
              onClick={() => setLocation("/funnels")}
              className="btn-press rounded-xl border-[#E3E1D8] bg-white hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            >
              <ArrowRight className="ml-2 size-4" />
              سجل الفانلات
            </Button>
          }
        />
        <section className="grid gap-7 md:grid-cols-2">
          <FunnelPathCard
            title="فانل بالذكاء الاصطناعي"
            description="نحلل المنتج ونبني نسخة AIDA ومشاهد إعلانية فريدة، ثم نحفظ المسودة تلقائيًا."
            icon={Wand2}
            primary
            onClick={() => setLocation("/funnels/ai")}
          />
          <FunnelPathCard
            title="ارفع تصميمك الخاص"
            description="ارفع تصميمك أو صفحته الجاهزة، وسنجهّز عليه نموذج الطلب وعناصر التحويل."
            icon={LayoutTemplate}
            onClick={() => setLocation("/funnels/import")}
          />
        </section>
        <section className="mt-7">
          <AbTestingCard onClick={() => setLocation("/funnels/ab-testing")} />
        </section>
        <section className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-[22px] border border-[#DFE9E1] bg-[var(--brand-soft)] p-5 text-xs font-bold text-[#41564B]">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--brand)]" />
            مشاهد إبداعية حول المنتج
          </span>
          <span className="flex items-center gap-2">
            <FileUp className="size-4 text-[var(--brand)]" />
            تصميم خاص قابل للرفع
          </span>
          <span className="flex items-center gap-2">
            <History className="size-4 text-[var(--brand)]" />
            حفظ تلقائي في السجل
          </span>
        </section>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <PageIntro
        eyebrow="التحويلات"
        title="سجل الفانلات"
        description="كل صفحة هبوط تنشئها تُحفظ هنا تلقائيًا. افتح المعاينة أو أنشئ فانلًا جديدًا في أي وقت."
        action={
          <Button
            onClick={() => setLocation("/funnels/create")}
            className="btn-press rounded-xl bg-[var(--brand)] font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            <Plus className="ml-2 size-4" />
            إنشاء فانل
          </Button>
        }
      />
      {historyQuery.isLoading ? (
        <section className="grid min-h-44 place-items-center rounded-[24px] border border-[#E7E9E2] bg-white text-sm font-bold text-[#79837D] shadow-soft">
          جارٍ تحميل سجل الفانلات…
        </section>
      ) : historyQuery.data?.length ? (
        <section className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft">
          <div className="divide-y divide-[#EDEFE8]">
            {historyQuery.data.map(page => {
              const status = statusLabel(page.status);
              return (
                <article
                  key={page.id}
                  className="flex flex-col gap-4 p-5 transition duration-200 hover:bg-[#FAFBF7] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <History className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-extrabold text-[#1F2A25]">
                          {page.title}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${status.classes}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8A938D]">
                        /{page.slug} · {page.framework} ·{" "}
                        {page.pageLength === "short"
                          ? "قصير"
                          : page.pageLength === "medium"
                            ? "متوسط"
                            : "طويل"}{" "}
                        · {new Date(page.createdAt).toLocaleDateString("ar-DZ")}
                      </p>
                      {page.generationError && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#F3D2CB] bg-[#FCE8E4] px-2.5 py-1.5 text-xs font-bold text-[#A63D28]">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {page.generationError}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(
                        `/funnels/ai/preview/${page.id}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="btn-press shrink-0 rounded-xl border-[#E3E1D8] bg-white text-[#41564B] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                  >
                    <Eye className="ml-2 size-4" />
                    معاينة
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={History}
          title="لا توجد صفحات هبوط بعد"
          description="أنشئ أول فانل من منتجك، وبعد التوليد ستجده محفوظًا هنا مع زر المعاينة."
          action={
            <Button
              onClick={() => setLocation("/funnels/create")}
              className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-bold text-white shadow-cta hover:bg-[var(--brand-strong)]"
            >
              <Plus className="ml-2 size-4" />
              إنشاء فانل
            </Button>
          }
        />
      )}
    </div>
  );
}
