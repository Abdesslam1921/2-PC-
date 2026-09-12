import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Palette,
  Sparkles,
  Store as StoreIcon,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { z } from "zod";

const TEMPLATES = [
  {
    id: "nordic-market",
    name: "سوق شمالي",
    primaryColor: "#2F5D8A",
    accentColor: "#f4b84a",
    fontFamily: "Cairo",
  },
  {
    id: "elegant",
    name: "أنيق",
    primaryColor: "#1f2937",
    accentColor: "#c9a227",
    fontFamily: "Cairo",
  },
  {
    id: "bold",
    name: "جريء",
    primaryColor: "#dc2626",
    accentColor: "#f97316",
    fontFamily: "Cairo",
  },
  {
    id: "minimal",
    name: "بسيط",
    primaryColor: "#0f766e",
    accentColor: "#f59e0b",
    fontFamily: "Cairo",
  },
];

const storeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "اسم المتجر مطلوب.")
    .max(160, "الاسم طويل جدًا."),
  slug: z
    .string()
    .trim()
    .min(2, "الرابط قصير جدًا.")
    .max(80)
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "الرابط يجب أن يبدأ وينتهي بحرف أو رقم، ويحتوي فقط على أحرف إنجليزية وأرقام وشرطات."
    ),
  language: z.string().trim().min(2).max(16),
});

type StoreValues = z.infer<typeof storeSchema>;
type AiStyle = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  style: string;
  description: string;
};

const inputClass =
  "h-12 w-full rounded-xl border border-[#E3E1D8] bg-white px-4 text-sm font-bold text-[#1F2A25] outline-none transition placeholder:text-[#9AA39D] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";
const textareaClass =
  "w-full rounded-xl border border-[#E3E1D8] bg-white px-4 py-3 text-sm font-bold leading-6 text-[#1F2A25] outline-none transition placeholder:text-[#9AA39D] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 resize-y min-h-[120px]";

export default function StoreCreate() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [aiStyle, setAiStyle] = useState<AiStyle | null>(null);
  const [prompt, setPrompt] = useState("");

  const utils = trpc.useUtils();
  const generateFromPrompt = trpc.stores.generateFromPrompt.useMutation({
    onSuccess: style => {
      setAiStyle({
        primaryColor: style.primaryColor,
        accentColor: style.accentColor,
        fontFamily: style.fontFamily,
        style: style.style,
        description: style.description,
      });
      if (style.name) form.setValue("name", style.name);
      setTemplateId(null);
      setStep(2);
    },
    onError: error => toast.error(error.message),
  });
  const createStore = trpc.stores.create.useMutation({
    onSuccess: async created => {
      await utils.stores.listMine.invalidate();
      await utils.stores.active.invalidate();
      toast.success("تم إنشاء المتجر.");
      window.location.href = "/dashboard";
    },
    onError: error => toast.error(error.message),
  });

  const form = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: "", slug: "", language: "dz-ar" },
  });

  const slugValue = form.watch("slug");
  const slugCheck = trpc.stores.checkSlugAvailability.useQuery(
    { slug: slugValue },
    { enabled: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slugValue), retry: false }
  );
  const slugAvailable =
    slugValue.length >= 2 && slugCheck.data?.available === true;

  const submit = form.handleSubmit(values => {
    createStore.mutate({
      name: values.name,
      slug: values.slug,
      language: values.language,
      templateId: templateId ?? undefined,
      aiStyleConfig: aiStyle ?? undefined,
    });
  });

  const selectedTemplate = TEMPLATES.find(
    template => template.id === templateId
  );

  return (
    <div dir="rtl" className="mx-auto max-w-[720px] pb-10">
      <div className="mb-4 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (step === 2) setStep(1);
            else setLocation("/dashboard");
          }}
          className="btn-press flex items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#5A6660] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
        >
          <ArrowLeft className="size-4" />
          رجوع
        </Button>
        <p className="text-xs font-bold text-[#8A938D]">الخطوة {step} من 2</p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-extrabold tracking-[0.12em] text-[var(--brand)]">
          متاجر متعددة
        </p>
        <h1 className="mt-1 text-2xl font-black text-[#1F2A25] sm:text-3xl">
          إنشاء متجر جديد
        </h1>
        <p className="mt-2 text-sm text-[#79837D]">
          اختر قالبًا جاهزًا أو ولّد هوية بصرية بالذكاء الاصطناعي، ثم أدخل
          تفاصيل المتجر.
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2">
        {([1, 2] as const).map(number => {
          const isCurrent = step === number;
          const accessible =
            number === 1 ? true : templateId !== null || aiStyle !== null;
          const node = (
            <>
              <span
                className={`grid size-7 place-items-center rounded-full text-xs font-extrabold ${
                  isCurrent
                    ? "bg-[var(--brand)] text-white"
                    : accessible
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "bg-[#EEF0EA] text-[#9AA39D]"
                }`}
              >
                {number}
              </span>
              <span
                className={`text-sm font-bold ${isCurrent ? "text-[var(--brand)]" : accessible ? "text-[#3D4A43]" : "text-[#9AA39D]"}`}
              >
                {number === 1 ? "اختيار القالب" : "تفاصيل المتجر"}
              </span>
            </>
          );
          return (
            <div key={number} className="flex items-center gap-2">
              {isCurrent || !accessible ? (
                <div className="flex items-center gap-2 cursor-default">
                  {node}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(number)}
                  className="btn-press flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                >
                  {node}
                </button>
              )}
              {number === 1 && <span className="h-px w-8 bg-[#E3E1D8]" />}
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="space-y-6">
          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#1F2A25]">
              <Palette className="size-5 text-[var(--brand)]" />
              قوالب جاهزة
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(template.id);
                    setAiStyle(null);
                    setStep(2);
                  }}
                  className={`btn-press rounded-2xl border p-4 text-right transition ${templateId === template.id ? "border-[var(--brand)] ring-4 ring-[var(--brand)]/10" : "border-[#E7E9E2] hover:border-[#C9CFC2] hover:shadow-lift"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-4 rounded-full"
                      style={{ backgroundColor: template.primaryColor }}
                    />
                    <span
                      className="size-4 rounded-full"
                      style={{ backgroundColor: template.accentColor }}
                    />
                    <span className="mr-auto text-xs font-bold text-[#8A938D]">
                      {template.fontFamily}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-extrabold text-[#1F2A25]">
                    {template.name}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#1F2A25]">
              <Sparkles className="size-5 text-[var(--brand)]" />
              توليد بالذكاء الاصطناعي (برومبت)
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#79837D]">
              صف متجرك بكلماتك وسيقترح الذكاء الاصطناعي ألوانًا وخطًا ونمطًا
              يناسب نشاطك. اكتب وصفًا تفصيليًا للحصول على أفضل نتيجة.
            </p>
            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              placeholder="مثال: متجر متخصص في بيع العطور النسائية الفاخرة، يستهدف شريحة راقية ويحب الأسلوب البسيط والأنيق بألوان هادئة..."
              className={`${textareaClass} mt-4`}
              rows={5}
            />
            <Button
              type="button"
              disabled={
                prompt.trim().length < 12 || generateFromPrompt.isPending
              }
              onClick={() => generateFromPrompt.mutate({ prompt: prompt })}
              className="btn-press mt-4 h-12 w-full rounded-xl bg-[var(--brand)] font-extrabold shadow-cta hover:bg-[var(--brand-strong)]"
            >
              {generateFromPrompt.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              توليد الهوية بالذكاء الاصطناعي
            </Button>
          </section>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className="space-y-5 rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft"
        >
          {(selectedTemplate || aiStyle) && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--brand-soft)] p-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-5 rounded-full border border-white shadow"
                  style={{
                    backgroundColor:
                      aiStyle?.primaryColor ?? selectedTemplate?.primaryColor,
                  }}
                />
                <span
                  className="size-5 rounded-full border border-white shadow"
                  style={{
                    backgroundColor:
                      aiStyle?.accentColor ?? selectedTemplate?.accentColor,
                  }}
                />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  {aiStyle
                    ? `هوية مولّدة — ${aiStyle.style}`
                    : `قالب ${selectedTemplate?.name}`}
                </p>
                {aiStyle?.description && (
                  <p className="mt-0.5 text-xs text-[#79837D]">
                    {aiStyle.description}
                  </p>
                )}
              </div>
              <StoreIcon className="mr-auto size-5 text-[var(--brand)]" />
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-xs font-extrabold text-[#3D4A43]">
              اسم المتجر
            </span>
            <input
              placeholder="اسم المتجر"
              className={inputClass}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="mt-1.5 text-xs font-bold text-[#A63D28]">
                {form.formState.errors.name.message}
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-extrabold text-[#3D4A43]">
              الرابط (slug)
            </span>
            <div className="flex items-center gap-2">
              <input
                dir="ltr"
                placeholder="storename"
                className={inputClass}
                {...form.register("slug")}
              />
              <span className="shrink-0 text-xs font-bold text-[#8A938D]">
                .abdou-store.com
              </span>
            </div>
            {form.formState.errors.slug && (
              <p className="mt-1.5 text-xs font-bold text-[#A63D28]">
                {form.formState.errors.slug.message}
              </p>
            )}
            {slugValue.length >= 2 && !form.formState.errors.slug && (
              <p
                className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${slugAvailable ? "text-[var(--brand)]" : slugCheck.isFetching ? "text-[#8A938D]" : "text-[#A63D28]"}`}
              >
                {slugAvailable && (
                  <>
                    <Check className="size-3.5" />
                    الرابط متاح
                  </>
                )}
                {!slugAvailable &&
                  !slugCheck.isFetching &&
                  "الرابط مستخدم بالفعل."}
                {slugCheck.isFetching && "جارٍ التحقق..."}
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-extrabold text-[#3D4A43]">
              اللغة
            </span>
            <select className={inputClass} {...form.register("language")}>
              <option value="dz-ar">العربية (الجزائر)</option>
              <option value="fr">الفرنسية</option>
              <option value="en">الإنجليزية</option>
            </select>
          </label>

          {createStore.error && (
            <div className="flex items-center gap-2 rounded-xl border border-[#F3D2CB] bg-[#FCE8E4] px-3 py-2.5 text-xs font-bold text-[#A63D28]">
              <AlertCircle className="size-4 shrink-0" />
              {createStore.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="btn-press h-12 rounded-xl border-[#E3E1D8] font-extrabold text-[#5A6660]"
            >
              رجوع
            </Button>
            <Button
              type="submit"
              disabled={
                createStore.isPending || slugCheck.data?.available === false
              }
              className="btn-press h-12 flex-1 rounded-xl bg-[var(--brand)] font-extrabold shadow-cta hover:bg-[var(--brand-strong)]"
            >
              {createStore.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4 -scale-x-100" />
              )}
              إنشاء المتجر
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
