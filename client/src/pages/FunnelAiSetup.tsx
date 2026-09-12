import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Flame,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Package,
  Palette,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PageLength = "short" | "medium" | "long";
type SetupStage = "brief" | "settings";

const lengths: Array<{
  value: PageLength;
  label: string;
  copy: string;
  icon: typeof Flame;
}> = [
  { value: "short", label: "قصير", copy: "4 أقسام تحويل أساسية", icon: Flame },
  {
    value: "medium",
    label: "متوسط",
    copy: "6 أقسام AIDA متوازنة",
    icon: Palette,
  },
  { value: "long", label: "طويل", copy: "8 أقسام لقصة المنتج", icon: FileText },
];

const fieldClass =
  "w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

export default function FunnelAiSetup() {
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
  const [stage, setStage] = useState<SetupStage>("brief");
  const [productId, setProductId] = useState("");
  const [length, setLength] = useState<PageLength>("short");
  const [locale, setLocale] = useState("dz-ar");
  const [notes, setNotes] = useState("");
  const [settings, setSettings] = useState({
    slug: "",
    delivery: "",
    metaPixel: "",
    tiktokPixel: "",
    snapchatPixel: "",
    thankYou: "",
  });
  const selectedProduct = products.find(
    product => String(product.id) === productId
  );
  const createDraft = trpc.landings.createAiDraft.useMutation({
    onSuccess: page => {
      toast.success("تم إنشاء مسودة صفحة الهبوط وحفظها في سجل الفانلات.");
      window.open(
        `/funnels/ai/preview/${page.id}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
    onError: error => toast.error(error.message),
  });

  const generate = () => {
    if (!selectedProduct) return;
    createDraft.mutate({
      productId: selectedProduct.id,
      pageLength: length,
      locale: locale as "dz-ar" | "ar" | "fr-dz",
      notes: notes || undefined,
      settings: { ...settings, payment: "cod" },
    });
  };

  const brief = (
    <div className="space-y-8 p-5 sm:p-7">
      <section>
        <p className="mb-3 text-sm font-extrabold text-[#1F2A25]">
          اختر إطار العمل
        </p>
        <div className="flex items-center gap-3 rounded-2xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-soft">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="font-extrabold text-[#1F2A25]">AIDA</p>
            <p className="mt-1 text-xs text-[#79837D]">
              Attention → Interest → Desire → Action
            </p>
          </div>
          <span className="mr-auto grid size-5 place-items-center rounded-full bg-[var(--brand)] text-white animate-check-pop">
            <Check className="size-3" />
          </span>
        </div>
      </section>
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
              onChange={event => setProductId(event.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-[#E3E1D8] bg-white px-4 pl-12 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
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
            description="أضف منتجًا يحتوي على صورة أصلية قبل التوليد."
          />
        )}
        {selectedProduct && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-3 animate-fade-up">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-[var(--brand)] shadow-soft">
              {selectedProduct.images[0]?.url ? (
                <img
                  src={selectedProduct.images[0].url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-4" />
              )}
            </span>
            <p className="text-xs font-extrabold text-[#1F2A25]">
              {selectedProduct.title}
              <span className="mt-1 block font-normal text-[#79837D]">
                المنتج هو المرجع الحقيقي للمشهد والنسخة والسعر.
              </span>
            </p>
          </div>
        )}
      </section>
      <section>
        <p className="mb-3 text-sm font-extrabold text-[#1F2A25]">
          اختر طول الصفحة
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {lengths.map(option => {
            const Icon = option.icon;
            const active = length === option.value;
            return (
              <button
                key={option.value}
                aria-pressed={active}
                onClick={() => setLength(option.value)}
                className={`btn-press rounded-2xl border p-4 text-right transition duration-200 ${active ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-soft" : "border-[#E7E9E2] bg-white hover:border-[#BFD3C8] hover:shadow-soft"}`}
              >
                <Icon
                  className={`size-5 ${active ? "text-[var(--brand)]" : "text-[#8A938D]"}`}
                />
                <p className="mt-3 text-sm font-extrabold text-[#1F2A25]">
                  {option.label}
                </p>
                <p className="mt-1 text-xs text-[#79837D]">{option.copy}</p>
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <label className="mb-3 block text-sm font-extrabold text-[#1F2A25]">
          اختر اللغة واللهجة
        </label>
        <select
          aria-label="اختر اللغة واللهجة"
          value={locale}
          onChange={event => setLocale(event.target.value)}
          className={`h-12 font-bold ${fieldClass}`}
        >
          <option value="dz-ar">العربية الجزائرية — DZ Arabic</option>
          <option value="ar">العربية الفصحى</option>
          <option value="fr-dz">الفرنسية الجزائرية</option>
        </select>
      </section>
      <section>
        <label className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
          <MessageSquareText className="size-4 text-[var(--brand)]" />
          مواصفات الكتابة المخصصة
        </label>
        <textarea
          aria-label="مواصفات الكتابة المخصصة"
          value={notes}
          maxLength={400}
          onChange={event => setNotes(event.target.value)}
          placeholder="مثال: الدفع عند الاستلام، لغة جزائرية بسيطة، ركز على الثبات..."
          className={`min-h-28 bg-[var(--paper)] px-4 py-3 leading-7 ${fieldClass}`}
        />
      </section>
      <div className="border-t border-[#ECEAE0] pt-6 text-center">
        <Button
          disabled={!selectedProduct}
          onClick={() => setStage("settings")}
          className="btn-press h-12 rounded-xl bg-[var(--brand)] px-7 font-extrabold shadow-cta hover:bg-[var(--brand-strong)]"
        >
          <Settings2 className="ml-2 size-4" />
          متابعة إعداد التصميم
        </Button>
      </div>
    </div>
  );

  const optionalSettings = (
    <div className="space-y-7 p-5 sm:p-7">
      <div className="flex items-center gap-3 rounded-2xl border border-[#D8E4DC] bg-[var(--brand-soft)] p-4 text-sm font-bold text-[#1F2A25]">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-soft">
          <Sparkles className="size-4" />
        </span>
        {selectedProduct?.title} ·{" "}
        {length === "short" ? "4" : length === "medium" ? "6" : "8"} أقسام AIDA
        · الدفع عند الاستلام
      </div>
      <section className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-extrabold text-[#1F2A25]">
          مسار الرابط{" "}
          <span className="font-normal text-[#8A938D]">(اختياري)</span>
          <input
            aria-label="مسار الرابط"
            value={settings.slug}
            onChange={event =>
              setSettings(current => ({
                ...current,
                slug: event.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-"),
              }))
            }
            placeholder="يُنشأ تلقائيًا إن تركته فارغًا"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
        <label className="text-sm font-extrabold text-[#1F2A25]">
          التوصيل <span className="font-normal text-[#8A938D]">(اختياري)</span>
          <select
            aria-label="سعر التوصيل"
            value={settings.delivery}
            onChange={event =>
              setSettings(current => ({
                ...current,
                delivery: event.target.value,
              }))
            }
            className={`mt-2 h-11 ${fieldClass}`}
          >
            <option value="">يُحدد لاحقًا</option>
            <option value="free">توصيل مجاني</option>
            <option value="500">500 دج</option>
            <option value="حسب الولاية">حسب الولاية</option>
          </select>
        </label>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Meta Pixel", "metaPixel"],
          ["TikTok Pixel", "tiktokPixel"],
          ["Snapchat Pixel", "snapchatPixel"],
        ].map(([label, key]) => (
          <label key={key} className="text-sm font-extrabold text-[#1F2A25]">
            {label}{" "}
            <span className="font-normal text-[#8A938D]">(اختياري)</span>
            <input
              aria-label={label}
              value={settings[key as keyof typeof settings]}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              className={`mt-2 h-11 ${fieldClass}`}
            />
          </label>
        ))}
      </section>
      <label className="block text-sm font-extrabold text-[#1F2A25]">
        رابط صفحة الشكر{" "}
        <span className="font-normal text-[#8A938D]">(اختياري)</span>
        <input
          aria-label="رابط صفحة الشكر"
          value={settings.thankYou}
          onChange={event =>
            setSettings(current => ({
              ...current,
              thankYou: event.target.value,
            }))
          }
          placeholder="/thank-you"
          className={`mt-2 h-11 ${fieldClass}`}
        />
      </label>
      <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4 text-xs leading-6 text-[#7A5B34]">
        كل هذه الإعدادات اختيارية. أنشئ المسودة الآن، وستحفظ تلقائيًا في سجل
        الفانلات. إن تركت مسار الرابط فارغًا، ينشئه النظام تلقائيًا.
      </div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-[#ECEAE0] pt-6">
        <Button
          variant="outline"
          onClick={() => setStage("brief")}
          className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
        >
          السابق
        </Button>
        <Button
          disabled={createDraft.isPending}
          onClick={generate}
          className="btn-press h-12 rounded-xl bg-[var(--brand)] px-7 font-extrabold shadow-cta hover:bg-[var(--brand-strong)]"
        >
          {createDraft.isPending ? (
            <>
              <Loader2 className="ml-2 size-4 animate-spin" />
              جارٍ إنشاء المسودة…
            </>
          ) : (
            <>
              <Wand2 className="ml-2 size-4" />
              إنشاء المسودة بالذكاء الاصطناعي
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <PageIntro
        eyebrow="الفانل · الذكاء الاصطناعي"
        title={stage === "brief" ? "إعداد صفحة الهبوط" : "إعدادات التصميم"}
        description={
          stage === "brief"
            ? "ابدأ بإطار AIDA، ثم اختر المنتج وطول السرد قبل ضبط الإعدادات الاختيارية."
            : "الرابط والتوصيل وPixels وصفحة الشكر اختيارية؛ يمكنك ضبطها الآن أو لاحقًا."
        }
        action={
          <Button
            variant="outline"
            onClick={() =>
              stage === "settings" ? setStage("brief") : setLocation("/funnels")
            }
            className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
          >
            <ArrowRight className="ml-2 size-4" />
            {stage === "settings" ? "رجوع للإعداد" : "رجوع للفانل"}
          </Button>
        }
      />
      <section className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft animate-fade-up">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_20%,rgba(222,124,42,.32),transparent_26%),linear-gradient(120deg,var(--brand-strong),var(--brand))] p-6 text-white sm:p-8">
          <p className="text-[10px] font-bold tracking-[.18em] text-[#F2D9B8]">
            AI LANDING STUDIO
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">
            {stage === "brief"
              ? "ابنِ قصة المنتج وفق AIDA"
              : "حوّل المخطط إلى مسودة جاهزة للمعاينة"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
            ننشئ مشاهد إعلانية حول المنتج الأصلي مع الحفاظ على هويته، ثم نعرض
            النص في مساحة منظمة بعيدًا عن الصورة.
          </p>
        </div>
        {stage === "brief" ? brief : optionalSettings}
      </section>
    </div>
  );
}
