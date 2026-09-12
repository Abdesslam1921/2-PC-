import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const sectionLabels: Record<string, string> = {
  hero: "Hero",
  categories: "الفئات",
  featured_products: "المنتجات المميزة",
  benefits: "المميزات",
  countdown: "عداد العرض",
  newsletter: "النشرة البريدية",
  story: "قصتنا",
};

export default function TemplateAi() {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const generate = trpc.templates.generate.useMutation({ onSuccess: setDraft });
  const save = trpc.templates.save.useMutation({
    onSuccess: () => toast.success("تم تفعيل القالب على المتجر."),
  });
  const handleGenerate = () => generate.mutate({ prompt });
  const handleActivate = () => {
    if (!draft) return;
    save.mutate({
      templateKey: `ai-${
        draft.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || "custom"
      }`,
      customization: {
        primaryColor: draft.primaryColor,
        accentColor: draft.accentColor,
        fontFamily: draft.fontFamily,
        showCountdown: draft.sections.includes("countdown"),
        showTrustBadges: draft.sections.includes("benefits"),
        showNewsletter: draft.sections.includes("newsletter"),
      },
    });
  };
  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/templates">
          <Button variant="ghost" size="icon" className="btn-press rounded-xl">
            <ArrowRight className="size-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm font-bold text-[var(--brand)]">مركز القوالب</p>
          <h1 className="text-3xl font-extrabold text-[#1F2A25]">
            أنشئ قالبك بالذكاء الاصطناعي
          </h1>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[24px] border-[#E7E9E2] shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-extrabold text-[#1F2A25]">
              <Sparkles className="size-5 text-[var(--brand)]" />
              صف فكرتك
            </CardTitle>
            <p className="text-sm leading-7 text-[#79837D]">
              اكتب نوع المتجر، الألوان، الأسلوب، الأقسام التي تريدها، وطريقة عرض
              المنتجات. سيُنشأ تصور أولي قابل للمراجعة قبل التفعيل.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              placeholder="مثال: متجر جزائري لمنتجات العناية الطبيعية، تصميم دافئ وراقي، صور كبيرة، ألوان زيتونية وذهبية، مع أقسام الفئات والمنتجات المميزة والمميزات..."
              className="min-h-44 rounded-2xl border-[#E3E1D8] leading-7 focus-visible:border-[var(--brand)] focus-visible:ring-4 focus-visible:ring-[#0B5B43]/10"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#8A938D]">
                {prompt.length}/1600 حرف
              </span>
              <Button
                className="btn-press rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
                onClick={handleGenerate}
                disabled={prompt.trim().length < 12 || generate.isPending}
              >
                {generate.isPending ? (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="ml-2 size-4" />
                )}
                توليد التصور
              </Button>
            </div>
            {generate.error && (
              <div className="flex items-center gap-2 rounded-xl border border-[#F3D2CB] bg-[#FCE8E4] p-3 text-sm text-[#A63D28]">
                <AlertCircle className="size-4 shrink-0" />
                تعذر التوليد حاليًا. راجع الطلب وحاول مرة أخرى.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-[#D8E6DD] bg-[var(--brand-soft)] shadow-soft">
          <CardHeader>
            <CardTitle className="font-extrabold text-[var(--brand-strong)]">
              كيف يعمل؟
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-[#4A5F53]">
            <p>
              <b className="text-[var(--brand-strong)]">1. اكتب الفكرة</b>
              <br />
              صف هوية المتجر والصفحة التي تريدها.
            </p>
            <p>
              <b className="text-[var(--brand-strong)]">2. راجع التصور</b>
              <br />
              تحقق من الألوان وترتيب الأقسام قبل الحفظ.
            </p>
            <p>
              <b className="text-[var(--brand-strong)]">3. خصّص وفعّل</b>
              <br />
              يمكنك تعديل القالب لاحقًا من مركز القوالب.
            </p>
          </CardContent>
        </Card>
      </div>
      {draft && (
        <Card className="animate-fade-up overflow-hidden rounded-[24px] border-[#E7E9E2] shadow-lift">
          <CardHeader className="flex flex-row items-center justify-between bg-[#FAF9F5]">
            <div>
              <Badge className="mb-2 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)]">
                <Eye className="ml-1 size-3" />
                معاينة فقط
              </Badge>
              <CardTitle className="text-2xl font-extrabold text-[#1F2A25]">
                {draft.name}
              </CardTitle>
              <p className="mt-1 text-sm text-[#79837D]">{draft.description}</p>
            </div>
            <div className="flex gap-2">
              <span
                className="size-8 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: draft.primaryColor }}
              />
              <span
                className="size-8 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: draft.accentColor }}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_260px]">
            <div
              className="rounded-2xl p-5 text-white"
              style={{
                background: `linear-gradient(135deg, ${draft.primaryColor}, ${draft.accentColor})`,
              }}
            >
              <p className="text-xs opacity-80">
                {draft.fontFamily} · RTL · Mobile First
              </p>
              <h2 className="mt-4 text-3xl font-extrabold">
                تجربة متجر مصممة لك
              </h2>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {draft.sections.map((section: string) => (
                  <div
                    key={section}
                    className="rounded-xl bg-white/15 px-3 py-3 text-sm font-bold backdrop-blur"
                  >
                    {sectionLabels[section] ?? section}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#F5F6F2] p-4">
                <p className="text-xs text-[#8A938D]">الحالة</p>
                <p className="mt-1 font-extrabold text-[var(--brand)]">
                  جاهز للمراجعة والتخصيص
                </p>
              </div>
              <Button
                variant="outline"
                className="btn-press w-full rounded-xl"
                onClick={() => setDraft(null)}
              >
                تعديل الوصف
              </Button>
              <Button
                className="btn-press w-full rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
                onClick={handleActivate}
                disabled={save.isPending}
              >
                <Check className="ml-2 size-4" />
                {save.isPending ? "جارٍ التفعيل..." : "حفظ وتفعيل القالب"}
              </Button>
              <Link href="/templates">
                <Button
                  variant="outline"
                  className="btn-press w-full rounded-xl"
                >
                  الانتقال للتخصيص
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
