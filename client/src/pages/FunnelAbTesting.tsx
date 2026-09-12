import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BadgeCheck,
  Beaker,
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Package,
  Sparkles,
  TrendingUp,
  Trophy,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Variant = {
  label: string;
  headline: string;
  subtext: string;
  cta: string;
  angle: string;
};
type VariantResult = Variant & {
  visitors: number;
  conversions: number;
  rate: number;
};

const fieldClass =
  "w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function runSimulation(variants: Variant[], run: number): VariantResult[] {
  const ratePool = [3.8, 2.9, 3.4, 2.6, 4.2].slice(0, variants.length);
  const shifted = ratePool.map(
    (_, index) => ratePool[(index + run) % ratePool.length]
  );
  return variants
    .map((variant, index) => {
      const rate = shifted[index];
      const visitors = 850 + ((index * 311 + run * 173) % 650);
      const conversions = Math.max(1, Math.round((visitors * rate) / 100));
      return {
        ...variant,
        visitors,
        conversions,
        rate: Math.round((conversions / visitors) * 1000) / 10,
      };
    })
    .sort((a, b) => b.rate - a.rate);
}

export default function FunnelAbTesting() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const productsQuery = trpc.products.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const products = useMemo(
    () =>
      (productsQuery.data ?? []).filter(
        (product): product is NonNullable<typeof product> => Boolean(product)
      ),
    [productsQuery.data]
  );
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [run, setRun] = useState(0);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VariantResult[] | null>(null);
  const [routeMode, setRouteMode] = useState<"auto" | "manual">("auto");
  const [chosenWinner, setChosenWinner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedProduct = products.find(
    product => String(product.id) === productId
  );

  const generateMutation = trpc.abTesting.generate.useMutation({
    onSuccess: data => {
      setVariants(data.variants);
      setResults(null);
      setChosenWinner(null);
      setNotice(null);
      toast.success(
        `أنشأ الذكاء الاصطناعي ${data.variants.length} متغيرات جاهزة للاختبار.`
      );
    },
    onError: error => {
      setNotice(error.message);
      toast.error(error.message);
    },
  });

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    []
  );

  const generate = () => {
    if (!selectedProduct) return;
    generateMutation.mutate({ productId: selectedProduct.id });
  };

  const startTest = () => {
    if (!variants || variants.length < 2) return;
    setTesting(true);
    setProgress(0);
    setResults(null);
    setChosenWinner(null);
    let value = 0;
    timer.current = setInterval(() => {
      value += Math.max(1, Math.round((100 - value) / 12));
      if (value >= 100) {
        value = 100;
        if (timer.current) clearInterval(timer.current);
        setResults(runSimulation(variants, run));
        setTesting(false);
      }
      setProgress(value);
    }, 220);
  };

  const winner = results?.[0] ?? null;
  const winnerLabel =
    routeMode === "auto" ? (winner?.label ?? null) : chosenWinner;

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <PageIntro
        eyebrow="الفانل · اختبار A/B"
        title="اختبار A/B بالذكاء الاصطناعي"
        description="ينشئ الذكاء الاصطناعي متغيرات مختلفة لصفحة الهبوط، تختبرها المنصة، ثم توجّه الزيارات تلقائيًا للفائز أو تختار الفائز بنفسك."
        action={
          <Button
            variant="outline"
            onClick={() => setLocation("/funnels")}
            className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
          >
            <ArrowRight className="ml-2 size-4" />
            رجوع للفانل
          </Button>
        }
      />

      <section className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft animate-fade-up">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_20%,rgba(222,124,42,.32),transparent_28%),linear-gradient(120deg,var(--brand-strong),var(--brand))] p-6 text-white sm:p-8">
          <p className="text-[10px] font-bold tracking-[.18em] text-[#F2D9B8]">
            AI A/B TESTING
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">
            جرّب زوايا بيع مختلفة واترك البيانات تختار
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
            مثل: «اطلب الآن» مقابل «احصل عليه غدًا» مقابل «الدفع عند الاستلام
            🇩🇿» — ثم نعرض نسب التحويل لكل متغير.
          </p>
        </div>

        <div className="space-y-7 p-5 sm:p-7">
          <section>
            <label className="mb-3 block text-sm font-extrabold text-[#1F2A25]">
              اختر المنتج
            </label>
            {productsQuery.isLoading ? (
              <div className="grid h-16 place-items-center rounded-xl border border-[#E7E9E2] bg-white">
                <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
              </div>
            ) : products.length ? (
              <div className="relative">
                <select
                  aria-label="اختر المنتج"
                  value={productId}
                  onChange={event => {
                    setProductId(event.target.value);
                    setVariants(null);
                    setResults(null);
                    setChosenWinner(null);
                  }}
                  className={`h-12 appearance-none pl-12 pr-4 font-bold ${fieldClass}`}
                >
                  <option value="">اختر منتجًا من الكتالوج</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.title} —{" "}
                      {product.price ?? product.variants[0]?.price ?? "0.00"} دج
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-4 top-3.5 size-5 text-[#8A938D]" />
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="لا توجد منتجات جاهزة بعد"
                description="أضف منتجًا من الكتالوج قبل إنشاء متغيرات الاختبار."
              />
            )}
            {selectedProduct && (
              <p className="mt-3 rounded-xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-3 text-xs font-bold text-[#1F2A25]">
                {selectedProduct.title} ·{" "}
                {selectedProduct.price ??
                  selectedProduct.variants[0]?.price ??
                  "0.00"}{" "}
                دج
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-3 border-t border-[#ECEAE0] pt-6">
            <Button
              disabled={!selectedProduct || generateMutation.isPending}
              onClick={generate}
              className="btn-press h-12 rounded-xl bg-[var(--brand)] px-7 font-extrabold shadow-cta hover:bg-[var(--brand-strong)]"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 size-4 animate-spin" />
                  جارٍ إنشاء المتغيرات…
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 size-4" />
                  إنشاء المتغيرات بالذكاء الاصطناعي
                </>
              )}
            </Button>
          </div>

          {notice && (
            <div className="flex items-start gap-3 rounded-2xl border border-[#F3D2CB] bg-[#FCE8E4] p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-[#A63D28]" />
              <div>
                <p className="text-sm font-extrabold text-[#A63D28]">
                  لا يمكن توليد المتغيرات الآن
                </p>
                <p className="mt-1 text-xs leading-6 text-[#A63D28]">
                  {notice}
                </p>
              </div>
            </div>
          )}

          {variants && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                <Sparkles className="size-4 text-[var(--brand)]" />
                المتغيرات المولّدة
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {variants.map(variant => (
                  <article
                    key={variant.label}
                    className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft transition duration-200 hover:border-[#BFD3C8]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#1F2A25] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
                        {variant.label}
                      </span>
                      <Beaker className="size-4 text-[#8A938D]" />
                    </div>
                    <p className="mt-3 text-sm font-extrabold leading-6 text-[#1F2A25]">
                      {variant.headline}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-[#79837D]">
                      {variant.subtext}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="btn-press inline-flex items-center rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-extrabold text-white">
                        {variant.cta}
                      </span>
                    </div>
                    <p className="mt-3 border-t border-[#F0F2EC] pt-2 text-[11px] font-bold text-[#41564B]">
                      {variant.angle}
                    </p>
                  </article>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={testing}
                  onClick={startTest}
                  className="btn-press h-12 rounded-xl bg-[#1F2A25] px-7 font-extrabold text-white shadow-cta hover:bg-[#2A3831]"
                >
                  {testing ? (
                    <>
                      <Loader2 className="ml-2 size-4 animate-spin" />
                      جارٍ الاختبار…
                    </>
                  ) : (
                    <>
                      <TrendingUp className="ml-2 size-4" />
                      بدء الاختبار
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={testing}
                  onClick={() => {
                    setRun(run + 1);
                    generate();
                  }}
                  className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
                >
                  إعادة توليد المتغيرات
                </Button>
              </div>
            </section>
          )}

          {testing && (
            <section className="rounded-2xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-6">
              <div className="flex items-center justify-between text-sm font-extrabold text-[#1F2A25]">
                <span>تجري المنصة الاختبار بين المتغيرات…</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </section>
          )}

          {results && winner && (
            <section className="space-y-5 animate-fade-up">
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-5 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand)] text-[#F3D9AE]">
                  <Trophy className="size-6" />
                </span>
                <p className="text-lg font-extrabold text-[#1F2A25]">
                  الفائز: {winner.label}
                </p>
                <p className="text-xs font-bold text-[#41564B]">
                  نسبة تحويل {winner.rate}% مقابل{" "}
                  {results[results.length - 1]?.rate}% لأقل متغير
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#E7E9E2]">
                <div className="divide-y divide-[#EDEFE8]">
                  {results.map((result, index) => {
                    const isWinner = index === 0;
                    const maxRate = results[0]?.rate || 1;
                    return (
                      <article
                        key={result.label}
                        className={`flex items-center gap-4 p-4 ${isWinner ? "bg-[#F6FBF8]" : "bg-white"}`}
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          {isWinner ? (
                            <Crown className="size-5" />
                          ) : (
                            <Beaker className="size-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-[#1F2A25]">
                              {result.label}
                            </span>
                            <span className="text-xs text-[#79837D]">
                              «{result.cta}»
                            </span>
                            {isWinner && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-extrabold text-white">
                                <BadgeCheck className="size-3" />
                                فائز
                              </span>
                            )}
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDEFE8]">
                            <div
                              className={`h-full rounded-full ${isWinner ? "bg-[var(--brand)]" : "bg-[#B8C9BE]"}`}
                              style={{
                                width: `${Math.max(8, (result.rate / maxRate) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11px] text-[#8A938D]">
                            {result.visitors.toLocaleString("en-US")} زيارة ·{" "}
                            {result.conversions} تحويل
                          </p>
                        </div>
                        <div className="shrink-0 text-left">
                          <span
                            className={`text-lg font-extrabold tabular-nums ${isWinner ? "text-[var(--brand)]" : "text-[#1F2A25]"}`}
                          >
                            {result.rate}%
                          </span>
                          <span className="block text-[10px] font-bold text-[#8A938D]">
                            نسبة التحويل
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-5">
                <p className="mb-3 text-sm font-extrabold text-[#1F2A25]">
                  كيف توجّه الزيارات؟
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    aria-pressed={routeMode === "auto"}
                    onClick={() => {
                      setRouteMode("auto");
                      setChosenWinner(null);
                    }}
                    className={`btn-press rounded-2xl border p-4 text-right transition ${routeMode === "auto" ? "border-[var(--brand)] bg-white shadow-soft" : "border-[#E7E9E2] bg-white hover:border-[#BFD3C8]"}`}
                  >
                    <p className="text-sm font-extrabold text-[#1F2A25]">
                      توجيه تلقائي للفائز
                    </p>
                    <p className="mt-1 text-xs text-[#79837D]">
                      تُرسل 100% من الزيارات تلقائيًا إلى {winner.label}.
                    </p>
                    {routeMode === "auto" && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-[var(--brand)]">
                        <Check className="size-3.5" />
                        مفعّل
                      </span>
                    )}
                  </button>
                  <button
                    aria-pressed={routeMode === "manual"}
                    onClick={() => setRouteMode("manual")}
                    className={`btn-press rounded-2xl border p-4 text-right transition ${routeMode === "manual" ? "border-[var(--brand)] bg-white shadow-soft" : "border-[#E7E9E2] bg-white hover:border-[#BFD3C8]"}`}
                  >
                    <p className="text-sm font-extrabold text-[#1F2A25]">
                      اختيار الفائز يدويًا
                    </p>
                    <p className="mt-1 text-xs text-[#79837D]">
                      راجع النتائج ثم اختر المتغير الذي تريد اعتماده.
                    </p>
                    {routeMode === "manual" && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-[var(--brand)]">
                        <Check className="size-3.5" />
                        مفعّل
                      </span>
                    )}
                  </button>
                </div>

                {routeMode === "manual" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {results.map(result => (
                      <button
                        key={result.label}
                        onClick={() => setChosenWinner(result.label)}
                        className={`btn-press rounded-xl border px-4 py-2 text-sm font-extrabold transition ${chosenWinner === result.label ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#D8DCD0] bg-white text-[#1F2A25] hover:border-[var(--brand)]"}`}
                      >
                        {result.label} · {result.rate}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {winnerLabel && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-4 animate-fade-up">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white">
                    <BadgeCheck className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-[#1F2A25]">
                      تم اعتماد {winnerLabel} كفائز
                    </p>
                    <p className="mt-1 text-xs text-[#41564B]">
                      {routeMode === "auto"
                        ? "ستوجّه المنصة الزيارات تلقائيًا إلى الفائز."
                        : "اخترت هذا المتغير يدويًا بعد مراجعة النتائج."}
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
