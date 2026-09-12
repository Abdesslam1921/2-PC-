import { PageIntro } from "@/components/PageIntro";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Sparkles,
  BarChart3,
  Eye,
  MousePointerClick,
  ShoppingCart,
  XCircle,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Brain,
  Zap,
  Target,
  RefreshCw,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const REJECTION_LABELS: Record<string, string> = {
  price: "السعر غالي",
  delivery: "التوصيل غالي",
  compare: "حبيت نقارن",
  hesitate: "مازلت متردد",
  payment: "ما لقيتش طريقة الدفع المناسبة",
  changed_mind: "غيرت رأيي",
};

const REJECTION_ICONS: Record<string, React.ReactNode> = {
  price: "💰",
  delivery: "🚚",
  compare: "⚖️",
  hesitate: "⏳",
  payment: "💳",
  changed_mind: "🔁",
};

const METRIC_CONFIG = [
  { key: "conversionRate", label: "تحويل", suffix: "%", icon: TrendingUp, color: "text-[#1F2A25]" },
  { key: "confirmationRate", label: "تأكيد", suffix: "%", icon: Target, color: "text-[#2E7D32]" },
  { key: "deliveryTime", label: "توصيل", suffix: " يوم", icon: Zap, color: "text-[#F57F17]" },
  { key: "refusalRate", label: "رفض", suffix: "%", icon: AlertTriangle, color: "text-[#C62828]" },
  { key: "averageOrderValue", label: "AOV", suffix: " دج", icon: ShoppingCart, color: "text-[#1565C0]" },
  { key: "cac", label: "CAC", suffix: " دج", icon: Target, color: "text-[#6A1B9A]" },
  { key: "profitPerDeliveredOrder", label: "ربح/طلب", suffix: " دج", icon: TrendingUp, color: "text-[#2E7D32]" },
] as const;

const CRO_SCAN_POINTS = [
  { ar: "صفحة المنتج", en: "Product page" },
  { ar: "إتمام الطلب", en: "Checkout" },
  { ar: "سرعة التحميل", en: "Loading speed" },
  { ar: "أزرار الحث", en: "CTA" },
  { ar: "التسعير", en: "Pricing" },
  { ar: "التقييمات", en: "Reviews" },
  { ar: "الثقة", en: "Trust" },
  { ar: "الصور", en: "Images" },
  { ar: "معلومات التوصيل", en: "Delivery info" },
  { ar: "السلال المتروكة", en: "Abandoned carts" },
  { ar: "معدل التحويل", en: "Conversion rate" },
];

const CRO_SEVERITY_STYLES: Record<
  string,
  { emoji: string; label: string; row: string; chip: string; title: string }
> = {
  red: {
    emoji: "🔴",
    label: "مشكلة حرجة",
    row: "border-[#F2C4C4] bg-[#FFF7F7]",
    chip: "bg-[#FDEBEB] text-[#C0392B]",
    title: "text-[#B03A2E]",
  },
  orange: {
    emoji: "🟠",
    label: "مشكلة ثانوية",
    row: "border-[#F0D5AE] bg-[#FFFBF2]",
    chip: "bg-[#FFF1DD] text-[#B45309]",
    title: "text-[#9A5B00]",
  },
  green: {
    emoji: "🟢",
    label: "نقطة قوة",
    row: "border-[#BCE3C8] bg-[#F6FCF7]",
    chip: "bg-[#E2F5E7] text-[#1E7A36]",
    title: "text-[#1F6E36]",
  },
};

export default function AiAnalytics() {
  const productAnalytics = trpc.sharkCod.productAnalytics.useQuery();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const hasProductData = !!productAnalytics.data?.length;

  const wilayaData = trpc.sharkCod.wilayaConversionIntelligence.useQuery(
    { productId: selectedProductId ?? undefined },
    { enabled: !!selectedProductId || hasProductData }
  );
  const productRecMutation = trpc.sharkCod.generateProductRecommendations.useMutation();
  const wilayaRecMutation = trpc.sharkCod.generateWilayaRecommendations.useMutation();
  const croAuditMutation = trpc.sharkCod.generateCroAudit.useMutation();
  const croFixMutation = trpc.sharkCod.autoFixCroIssues.useMutation();

  const [productRecommendations, setProductRecommendations] = useState<string[] | null>(null);
  const [wilayaRecommendations, setWilayaRecommendations] = useState<string[] | null>(null);
  const [croScanStep, setCroScanStep] = useState(0);

  useEffect(() => {
    if (!croAuditMutation.isPending) return;
    setCroScanStep(0);
    const id = window.setInterval(() => {
      setCroScanStep(prev => Math.min(prev + 1, CRO_SCAN_POINTS.length - 1));
    }, 340);
    return () => window.clearInterval(id);
  }, [croAuditMutation.isPending]);

  const selectedProduct =
    productAnalytics.data?.find(p => p.id === selectedProductId) ??
    productAnalytics.data?.[0];
  const hasWilayaData = wilayaData.data && wilayaData.data.length > 0;

  const handleSelectProduct = (value: string) => {
    const id = value ? Number(value) : null;
    setSelectedProductId(id);
    setWilayaRecommendations(null);
  };

  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-9">
      <PageIntro
        eyebrow="النمو والتسويق"
        title="التحليل بالذكاء الاصطناعي"
        description="توصيات مبنية على بيانات متجرك الحقيقية."
      />

      <div className="mt-5 overflow-hidden rounded-[24px] border-2 border-[var(--brand)] bg-white p-5 shadow-soft sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-base font-extrabold text-[#1F2A25]">
                AI CRO Agent
              </h2>
              <p className="mt-1 text-xs text-[#8A938D]">
                فحص كامل لمتجرك: صفحة المنتج، الشك أوت، السرعة، CTA، التسعير،
                التقييمات، الثقة، الصور، التوصيل، السلال المتروكة والتحويل.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
            AI CRO
          </span>
        </div>

        {croAuditMutation.isPending ? (
          <div className="rounded-2xl border border-[#E7E9E2] bg-[#F7F8F4] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#4A554F]">
              <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
              جاري فحص متجرك…
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {CRO_SCAN_POINTS.map((point, idx) => {
                const done = idx < croScanStep;
                const active = idx === croScanStep;
                return (
                  <div
                    key={point.en}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                      done
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : active
                          ? "bg-white text-[#1F2A25] shadow-sm"
                          : "text-[#A6AEA8]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-[var(--brand)]" />
                    ) : (
                      <span
                        className={`grid size-3.5 shrink-0 place-items-center rounded-full ${
                          active ? "bg-[var(--warm)]" : "bg-[#E1E5DE]"
                        }`}
                      >
                        {active ? (
                          <Loader2 className="size-2.5 animate-spin text-white" />
                        ) : null}
                      </span>
                    )}
                    <span className="truncate">
                      {point.ar} · {point.en}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : croAuditMutation.data?.findings?.length ? (
          <>
            <div className="space-y-2">
              {croAuditMutation.data.findings.map((finding, idx) => {
                const style =
                  CRO_SEVERITY_STYLES[finding.severity] ??
                  CRO_SEVERITY_STYLES.orange;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 ${style.row}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none">{style.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${style.chip}`}
                          >
                            {style.label}
                          </span>
                          <span className="text-[9px] font-bold text-[#8A938D]">
                            رقم {idx + 1}
                          </span>
                        </div>
                        <p
                          className={`mt-1 text-sm font-extrabold ${style.title}`}
                        >
                          {finding.title}
                        </p>
                        {finding.detail ? (
                          <p className="mt-0.5 text-xs leading-5 text-[#4A554F]">
                            {finding.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-[#E7E9E2] pt-4">
              <button
                onClick={() => croFixMutation.mutate()}
                disabled={croFixMutation.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2 text-[10px] font-extrabold text-white transition-transform hover:scale-105 disabled:opacity-50"
              >
                {croFixMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Wrench className="size-3" />
                )}
                Fix automatically
              </button>
              <button
                onClick={() => croAuditMutation.mutate()}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-white px-4 py-2 text-[10px] font-extrabold text-[#4A554F] transition-transform hover:scale-105"
              >
                <RefreshCw className="size-3" />
                إعادة الفحص
              </button>
              <p className="text-[9px] text-[#8A938D]">
                الإصلاح التلقائي يفعّل أدوات متجرك الموصى بها مباشرة.
              </p>
            </div>

            {croFixMutation.isPending ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#4A554F]">
                <Loader2 className="size-3.5 animate-spin text-[var(--brand)]" />
                جاري تطبيق الإصلاحات…
              </div>
            ) : null}
            {croFixMutation.isError ? (
              <p className="mt-3 text-xs font-bold text-[#C62828]">
                {croFixMutation.error.message}
              </p>
            ) : null}
            {croFixMutation.data?.results?.length ? (
              <div className="mt-3 space-y-1.5">
                {croFixMutation.data.results.map(result => (
                  <div
                    key={result.key}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                      result.ok
                        ? "border-[#BCE3C8] bg-[#F6FCF7]"
                        : "border-[#E7E9E2] bg-[#FAFBF8]"
                    }`}
                  >
                    {result.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#1E8E3E]" />
                    ) : (
                      <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-[#E1E5DE] text-[8px] font-extrabold text-[#8A938D]">
                        i
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold text-[#1F2A25]">
                        {result.label}
                        {result.ok ? (
                          <span className="mr-1 text-[#1E8E3E]">— تم</span>
                        ) : null}
                      </p>
                      <p className="text-[10px] leading-5 text-[#79837D]">
                        {result.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-[#E7E9E2] bg-[#F7F8F4] p-4">
            <p className="mb-2 text-[11px] font-bold text-[#4A554F]">
              ما سيفحصه الذكاء الاصطناعي:
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {CRO_SCAN_POINTS.map(point => (
                <span
                  key={point.en}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-[#4A554F]"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--warm)]" />
                  {point.ar} · {point.en}
                </span>
              ))}
            </div>
            <button
              onClick={() => croAuditMutation.mutate()}
              disabled={croAuditMutation.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 sm:w-auto"
            >
              {croAuditMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Analyze my store
            </button>
            {croAuditMutation.isError ? (
              <p className="mt-3 text-xs font-bold text-[#C62828]">
                {croAuditMutation.error.message}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1F2A25]">
              تحليل منتجاتك
            </h2>
            <p className="mt-1 text-xs text-[#8A938D]">
              اختر منتجًا لرؤية إحصائيات الأداء والتحليل بالذكاء الاصطناعي.
            </p>
          </div>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
            AI
          </span>
        </div>

        {hasProductData ? (
          <>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-extrabold text-[#4A554F]">
                اختر منتج
              </label>
              <Select
                value={selectedProductId?.toString() ?? ""}
                onValueChange={value =>
                  setSelectedProductId(value ? Number(value) : null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر منتجًا لعرض تحليله" />
                </SelectTrigger>
                <SelectContent>
                  {productAnalytics.data!.map(product => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      <div className="flex items-center gap-2">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.title}
                            className="h-6 w-6 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#F1F3EE]">
                            <BarChart3 className="size-3 text-[#8A938D]" />
                          </div>
                        )}
                        <span>{product.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct ? (
              <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F8F4] p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {selectedProduct.image ? (
                      <img
                        src={selectedProduct.image}
                        alt={selectedProduct.title}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#E2E5DC]">
                        <BarChart3 className="size-6 text-[#8A938D]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-[#1F2A25]">
                        {selectedProduct.title}
                      </h3>
                      {selectedProduct.price && (
                        <p className="text-sm text-[#8A938D]">
                          {selectedProduct.price} دينار جزائري
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      productRecMutation.mutate({
                        productId: selectedProduct.id,
                      });
                      setProductRecommendations(null);
                    }}
                    disabled={productRecMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2 text-[10px] font-extrabold text-white transition-transform hover:scale-105 disabled:opacity-50"
                  >
                    {productRecMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                    تحليل بالذكاء الاصطناعي
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center">
                    <Eye className="size-4 text-[#8A938D]" />
                    <span className="text-lg font-extrabold text-[#1F2A25]">
                      {selectedProduct.views}
                    </span>
                    <span className="text-[9px] text-[#8A938D]">مشاهدات</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center">
                    <MousePointerClick className="size-4 text-[#8A938D]" />
                    <span className="text-lg font-extrabold text-[#1F2A25]">
                      {selectedProduct.ctaClicks}
                    </span>
                    <span className="text-[9px] text-[#8A938D]">نقرات CTA</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center">
                    <ShoppingCart className="size-4 text-[#8A938D]" />
                    <span className="text-lg font-extrabold text-[#1F2A25]">
                      {selectedProduct.discountOrders}
                    </span>
                    <span className="text-[9px] text-[#8A938D]">
                      طلبات مخفضة
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center">
                    <XCircle className="size-4 text-[#8A938D]" />
                    <span className="text-lg font-extrabold text-[#1F2A25]">
                      {Object.values(selectedProduct.rejections).reduce(
                        (sum: number, v: number) => sum + v,
                        0
                      )}
                    </span>
                    <span className="text-[9px] text-[#8A938D]">رفض العرض</span>
                  </div>
                </div>

                {selectedProduct.ctr > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] text-[#8A938D]">
                        نسبة النقر (CTR)
                      </p>
                      <p className="font-extrabold text-[#1F2A25]">
                        {selectedProduct.ctr}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#8A938D]">نسبة التحويل</p>
                      <p className="font-extrabold text-[#1F2A25]">
                        {selectedProduct.conversionRate}%
                      </p>
                    </div>
                  </div>
                )}

                {Object.keys(selectedProduct.rejections).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[9px] font-extrabold text-[#8A938D]">
                      أسباب الرفض
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selectedProduct.rejections).map(
                        ([key, count]) => (
                          <span
                            key={key}
                            className="flex items-center gap-1 rounded-full bg-[#F1F3EE] px-2 py-1 text-[10px] font-extrabold text-[#4A554F]"
                          >
                            <span className="text-xs">
                              {REJECTION_ICONS[key] ?? "📊"}
                            </span>
                            {REJECTION_LABELS[key] ?? key}: {count}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {productRecMutation.data?.recommendations?.length ? (
                  <div className="mt-4 space-y-2">
                    {productRecMutation.data.recommendations.map(
                      (rec: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex gap-2.5 rounded-xl bg-white p-3 text-xs leading-6 text-[#4A554F]"
                        >
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--warm-soft)] text-[10px] font-extrabold text-[var(--warm)]">
                            {idx + 1}
                          </span>
                          {rec}
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-[#8A938D]">
                اختر منتجًا من القائمة أعلاه.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-[#8A938D]">
            ستظهر إحصائيات المنتجات هنا بعد جمع بيانات كافية من زوار متجرك.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇩🇿</span>
            <div>
              <h2 className="text-base font-extrabold text-[#1F2A25]">
                Wilaya Conversion Intelligence
              </h2>
              <p className="mt-1 text-xs text-[#8A938D]">
                خريطة تحويل لكل ولاية: تحويل، تأكيد، توصيل، رفض، AOV، CAC، ربح
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
            AI GEO
          </span>
        </div>

        {wilayaData.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#79837D]">
            <Loader2 className="size-4 animate-spin" />
            جاري تحميل بيانات الولايات…
          </div>
        ) : hasWilayaData ? (
          <>
            <div className="mb-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#E7E9E2]">
                    <TableHead className="text-xs font-extrabold text-[#8A938D]">الولاية</TableHead>
                    {METRIC_CONFIG.map(m => (
                      <TableHead key={m.key} className="text-xs font-extrabold text-[#8A938D] text-center">
                        {m.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-extrabold text-[#8A938D]">إجمالي الطلبات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wilayaData.data!.map((w, idx) => (
                    <TableRow key={w.wilaya} className={idx % 2 === 0 ? "bg-[#F7F8F4]" : ""}>
                      <TableCell className="font-medium text-[#1F2A25] flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-[#8A938D]" />
                        {w.wilaya}
                        {w.wilayaCode && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E7E9E2] text-[#8A938D]">
                            {w.wilayaCode}
                          </span>
                        )}
                      </TableCell>
                      {METRIC_CONFIG.map(m => {
                        const value = w[m.key as keyof typeof w];
                        const formatted = typeof value === "number"
                          ? (m.key === "deliveryTime" ? value.toFixed(1) : value.toLocaleString())
                          : "—";
                        const isBadMetric = m.key === "refusalRate" || m.key === "cac";
                        const isGoodMetric = m.key === "conversionRate" || m.key === "confirmationRate" || m.key === "profitPerDeliveredOrder";
                        let color = "#1F2A25";
                        if (isBadMetric && typeof value === "number" && value > 15) color = "#C62828";
                        else if (isGoodMetric && typeof value === "number" && value > 0) color = "#2E7D32";
                        return (
                          <TableCell key={m.key} className="text-center text-xs font-medium" style={{ color }}>
                            {formatted}{m.suffix}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-xs text-[#8A938D]">
                        {w.totalOrders}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mb-4 flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  wilayaRecMutation.mutate();
                  setWilayaRecommendations(null);
                }}
                disabled={wilayaRecMutation.isPending}
                className="flex items-center gap-1.5"
              >
                {wilayaRecMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Brain className="size-3.5" />
                )}
                تحليل جغرافي بالذكاء الاصطناعي
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => wilayaData.refetch()}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                تحديث البيانات
              </Button>
            </div>

            {wilayaRecMutation.isPending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#79837D]">
                <Loader2 className="size-4 animate-spin" />
                جاري تحليل الذكاء الجغرافي…
              </div>
            ) : wilayaRecMutation.data?.recommendations?.length ? (
              <div className="space-y-2">
                {wilayaRecMutation.data.recommendations.map(
                  (rec: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex gap-2.5 rounded-xl bg-[var(--warn-soft)] p-3 text-xs leading-6 text-[#4A554F] border border-[var(--warn)]"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--warn)] text-[10px] font-extrabold text-white">
                        {idx + 1}
                      </span>
                      {rec}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-[#8A938D]">
                اضغط على "تحليل جغرافي بالذكاء الاصطناعي" للحصول على توصيات مبنية على فروقات الولايات.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-[#8A938D]">
            ستظهر بيانات الولايات هنا بعد وجود طلبات كافية من متجرك.
          </p>
        )}
      </div>
    </div>
  );
}