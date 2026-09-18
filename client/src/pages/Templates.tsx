import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Check,
  Eye,
  LayoutTemplate,
  Monitor,
  Palette,
  Smartphone,
  Sparkles,
  Zap,
  Star,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const FALLBACK_CUSTOMIZATION = {
  primaryColor: "var(--brand)",
  accentColor: "#f4b84a",
  fontFamily: "Cairo",
  showCountdown: true,
  showTrustBadges: true,
  showNewsletter: true,
};

// معاينات مصغرة حقيقية لكل قالب - مشي غير لون
function MiniPreview({
  templateKey,
  customization,
}: {
  templateKey: string;
  customization: any;
}) {
  if (templateKey === "fashion-luxe") {
    return (
      <div className="p-3 space-y-2 bg-white">
        <div className="h-20 rounded-xl bg-black text-white p-3 flex flex-col justify-end">
          <span className="text-[10px] font-black">NEW COLLECTION</span>
          <span className="text-sm font-black">FASHION LUXE</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="h-12 bg-zinc-100 rounded-lg" />
          <div className="h-12 bg-zinc-100 rounded-lg" />
          <div className="h-12 bg-zinc-100 rounded-lg" />
        </div>
        <div className="h-6 rounded-full bg-zinc-900 w-1/2 mx-auto" />
      </div>
    );
  }
  if (templateKey === "electro-hub") {
    return (
      <div className="p-3 space-y-2 bg-[#f5f7ff]">
        <div className="flex gap-1">
          <span className="text-[8px] bg-blue-600 text-white px-2 py-1 rounded-full">
            TOP DEALS
          </span>
          <span className="text-[8px] bg-yellow-400 px-2 py-1 rounded-full">
            24H
          </span>
        </div>
        <div
          className="h-16 rounded-xl p-2 text-white flex items-center justify-between"
          style={{ background: customization.primaryColor }}
        >
          <span className="text-xs font-black">خصم 40% اليوم</span>
          <span className="bg-white text-black text-[8px] px-2 py-1 rounded-full">
            تسوق
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-10 bg-white rounded-lg border flex flex-col items-center justify-center"
            >
              <div className="size-4 bg-slate-200 rounded-full" />
              <span className="text-[6px] mt-1">Phone</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (templateKey === "beauty-glow") {
    return (
      <div className="p-3 space-y-2 bg-[#fff5f8]">
        <div className="h-20 rounded-[1.2rem] bg-gradient-to-br from-pink-500 to-rose-300 p-3 text-white">
          <span className="text-[9px]">BEAUTY GLOW</span>
          <p className="text-xs font-black mt-1">جمالك يبدأ هنا</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-white rounded-xl p-1">
            <div className="h-10 bg-pink-50 rounded-lg" />
            <p className="text-[7px] mt-1 text-center">قبل / بعد</p>
          </div>
          <div className="h-16 bg-white rounded-xl p-2 flex flex-col justify-center">
            <div className="flex gap-1">
              <Star className="size-2 fill-yellow-400 text-yellow-400" />
              <Star className="size-2 fill-yellow-400 text-yellow-400" />
              <Star className="size-2 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-[7px] mt-1">"روعة!"</p>
          </div>
        </div>
      </div>
    );
  }
  // market-pro - نفس الفيديو
  return (
    <div className="p-3 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-orange-100 flex items-center justify-center">
          <ShoppingBag className="size-3" />
        </div>
        <div>
          <p className="text-[8px] font-black">مورد متميز</p>
          <p className="text-[6px] text-zinc-500">توصيل 58 ولاية</p>
        </div>
      </div>
      <div
        className="h-12 rounded-xl flex items-center justify-between px-3"
        style={{
          background: `linear-gradient(135deg, ${customization.primaryColor}, #9f96ff)`,
        }}
      >
        <span className="text-white text-[9px] font-black">بانر بسيط</span>
        <span className="bg-white text-[7px] px-2 py-1 rounded-full font-bold">
          SHOP NOW
        </span>
      </div>
      <div className="flex gap-2 overflow-hidden">
        <div className="min-w-[50px] h-10 bg-zinc-100 rounded-lg" />
        <div className="min-w-[50px] h-10 bg-zinc-100 rounded-lg" />
        <div className="min-w-[50px] h-10 bg-zinc-100 rounded-lg" />
      </div>
      <div className="flex gap-1">
        <span className="text-[6px] bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
          ⭐ 4.9 (120)
        </span>
        <span className="text-[6px] bg-green-50 text-green-600 px-2 py-1 rounded-full">
          دفع عند الاستلام
        </span>
      </div>
    </div>
  );
}

export default function Templates() {
  const presets = trpc.templates.presets.useQuery();
  const settings = trpc.templates.settings.useQuery();
  const save = trpc.templates.save.useMutation({
    onSuccess: () => settings.refetch(),
  });
  const [selected, setSelected] = useState("market-pro");
  const storefrontManaged = trpc.storefront.managed.useQuery();
  const [, setLocation] = useLocation();
  const enableTemplate = trpc.storefront.enableTemplate.useMutation({
    onSuccess: data => {
      toast.success(`تم تفعيل قالب ${data.templateKey} ونشره على واجهة المتجر.`);
      void storefrontManaged.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const startEditing = trpc.storefront.startEditing.useMutation();
  const openEditor = (templateKey: "modern" | "minimal" | "bold" | "boutique") =>
    startEditing.mutate(
      { templateKey },
      {
        onSuccess: data => {
          try {
            sessionStorage.setItem(
              "sf-builder-seed",
              JSON.stringify({ config: data.config, version: data.version })
            );
          } catch {
            // ignore storage failures
          }
          setLocation("/store/editor?tab=content");
        },
        onError: error => toast.error(error.message),
      }
    );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "mobile"
  );
  const [customization, setCustomization] = useState(FALLBACK_CUSTOMIZATION);
  const activeKey = settings.data?.templateKey ?? selected;
  const activeCustomization = useMemo(
    () => ({
      ...FALLBACK_CUSTOMIZATION,
      ...((settings.data?.customization as any) ?? customization),
    }),
    [settings.data?.customization, customization]
  );

  const choose = (key: string) => {
    setSelected(key);
    const preset = presets.data?.find(item => item.key === key);
    if (preset)
      setCustomization({
        ...customization,
        primaryColor: preset.colors[0],
        accentColor: preset.colors[1],
      });
  };

  const saveTemplate = () =>
    save.mutate({ templateKey: selected, customization });

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-[rgba(15,118,110,0.14)] bg-gradient-to-l from-[var(--brand-soft)] via-white to-[#fffaf1] p-6 shadow-[0_18px_60px_rgba(15,118,110,0.10)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--brand)]">
            <LayoutTemplate className="size-4" /> مركز القوالب البرو
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#181a2b]">
            اختر قالب يبيع، مشي غير لون
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#73758a]">
            كل قالب عنده هيكل مختلف، سلايدر، تقييمات، وكيفاش يعرض المنتجات.
            المعاينة على اليمين توريك الفرق الحقيقي.
          </p>
        </div>
        <Link href="/templates/ai">
          <Button className="brand-shine cta-gradient h-12 rounded-2xl bg-[var(--brand)] px-5 font-extrabold shadow-lg shadow-[var(--brand)]/20">
            <Sparkles className="ml-2 size-4" />
            إنشاء قالب بالذكاء الاصطناعي
          </Button>
        </Link>
      </div>

      <Card className="rounded-[1.7rem] border-[rgba(15,118,110,0.14)] bg-white shadow-soft">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--brand)]">
              <Sparkles className="size-4" /> نظام القوالب الجديد
            </div>
            <span className="text-xs font-bold text-[#576B66]">
              {storefrontManaged.data?.published
                ? `المنشور: ${storefrontManaged.data.published.templateKey ?? "—"} · الإصدار ${storefrontManaged.data.published.versionNumber}`
                : "لم يُفعَّل بعد — الواجهة القديمة (Legacy) تعمل."}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["modern", "minimal", "bold", "boutique"] as const).map(key => {
              const isPublished =
                storefrontManaged.data?.published?.templateKey === key;
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-[#e7e9e8] p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <b className="text-sm capitalize">{key}</b>
                    {isPublished ? (
                      <Badge className="rounded-full bg-[#e4f3ef] text-[var(--brand)] hover:bg-[#e4f3ef]">
                        منشور
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => enableTemplate.mutate({ templateKey: key })}
                      disabled={enableTemplate.isPending}
                      variant={isPublished ? "default" : "outline"}
                      className={`h-9 flex-1 rounded-lg text-xs font-extrabold ${
                        isPublished ? "brand-shine cta-gradient" : ""
                      }`}
                    >
                      تفعيل
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openEditor(key)}
                      disabled={startEditing.isPending}
                      className="h-9 flex-1 rounded-lg text-xs font-extrabold"
                    >
                      تعديل
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#181a2b]">
                4 قوالب برو جاهزة
              </h2>
              <p className="text-sm text-[#85879a]">
                مستوحاة من أشهر قوالب Shopify و Porto
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {presets.data?.length ?? 0} قوالب
            </Badge>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {(presets.data ?? []).map(template => (
              <Card
                key={template.key}
                className={`overflow-hidden rounded-[1.7rem] border-[rgba(15,118,110,0.14)] bg-white shadow-soft transition hover:shadow-xl ${activeKey === template.key ? "ring-2 ring-[var(--brand)] shadow-lg" : ""}`}
              >
                <div className="relative h-64 overflow-hidden bg-white border-b">
                  <MiniPreview
                    templateKey={template.key}
                    customization={{
                      primaryColor: template.colors[0],
                      accentColor: template.colors[1],
                    }}
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Badge className="rounded-full bg-black/80 text-white backdrop-blur text-[10px]">
                      <Zap className="ml-1 size-3" />
                      {(template as any).layout}
                    </Badge>
                  </div>
                </div>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-[17px] font-black">
                      {template.name}
                    </CardTitle>
                    {activeKey === template.key && (
                      <Badge className="rounded-full bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)]">
                        <Check className="ml-1 size-3" />
                        مفعّل
                      </Badge>
                    )}
                  </div>
                  <p className="text-[13px] leading-5 text-[#77798d]">
                    {template.description}
                  </p>
                  <p className="text-[11px] text-[var(--brand)] font-bold">
                    مثالي لـ: {(template as any).bestFor}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.sections.slice(0, 4).map(section => (
                      <Badge
                        key={section}
                        variant="secondary"
                        className="rounded-full bg-[#f7f6fc] text-[10px] text-[#686a7b]"
                      >
                        {section}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {((template as any).features ?? [])
                      .slice(0, 2)
                      .map((f: string) => (
                        <span
                          key={f}
                          className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-full"
                        >
                          ✓ {f}
                        </span>
                      ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl h-10"
                      onClick={() => choose(template.key)}
                    >
                      <Eye className="ml-2 size-4" />
                      معاينة
                    </Button>
                    <Button
                      className="brand-shine cta-gradient flex-1 rounded-xl bg-[var(--brand)] h-10"
                      onClick={() => {
                        choose(template.key);
                        save.mutate({
                          templateKey: template.key,
                          customization,
                        });
                      }}
                    >
                      {activeKey === template.key
                        ? "مفعّل حاليا"
                        : "استخدام هذا القالب"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden rounded-[1.7rem] border-[rgba(15,118,110,0.14)] bg-white shadow-soft">
            <CardHeader className="border-b border-[rgba(15,118,110,0.12)] bg-[var(--brand-soft)]">
              <div className="flex items-center justify-between">
                <CardTitle className="font-black flex items-center gap-2">
                  <Palette className="size-4" />
                  المعاينة الحية - فرق حقيقي
                </CardTitle>
                <div className="flex rounded-xl bg-white p-1 shadow-sm">
                  <Button
                    size="icon"
                    variant={previewMode === "desktop" ? "secondary" : "ghost"}
                    className="size-8 rounded-lg"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={previewMode === "mobile" ? "secondary" : "ghost"}
                    className="size-8 rounded-lg"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                هذا مشي غير تغيير لون، كل قالب عنده structure مختلف
              </p>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div
                className={`mx-auto overflow-hidden rounded-[1.5rem] border-[6px] border-[#222437] bg-white shadow-2xl transition-all ${previewMode === "mobile" ? "max-w-[280px]" : "w-full"}`}
              >
                <div className="h-7 bg-[#222437] flex items-center justify-center">
                  <div className="w-12 h-1.5 bg-white/30 rounded-full" />
                </div>
                <MiniPreview
                  templateKey={activeKey}
                  customization={activeCustomization}
                />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>اللون الرئيسي</Label>
                    <Input
                      type="color"
                      value={customization.primaryColor}
                      onChange={e =>
                        setCustomization({
                          ...customization,
                          primaryColor: e.target.value,
                        })
                      }
                      className="mt-2 h-11 w-full rounded-xl p-1"
                    />
                  </div>
                  <div>
                    <Label>لون التمييز</Label>
                    <Input
                      type="color"
                      value={customization.accentColor}
                      onChange={e =>
                        setCustomization({
                          ...customization,
                          accentColor: e.target.value,
                        })
                      }
                      className="mt-2 h-11 w-full rounded-xl p-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[var(--brand-soft)] p-3">
                  <Label>عرض العداد</Label>
                  <Switch
                    checked={customization.showCountdown}
                    onCheckedChange={c =>
                      setCustomization({ ...customization, showCountdown: c })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[var(--brand-soft)] p-3">
                  <Label>عناصر الثقة</Label>
                  <Switch
                    checked={customization.showTrustBadges}
                    onCheckedChange={c =>
                      setCustomization({ ...customization, showTrustBadges: c })
                    }
                  />
                </div>
                <Button
                  className="brand-shine cta-gradient w-full rounded-xl bg-[var(--brand)] h-11 font-black"
                  onClick={saveTemplate}
                  disabled={save.isPending}
                >
                  حفظ وتفعيل القالب البرو
                </Button>
                <p className="text-[11px] text-center text-zinc-400">
                  القالب يتغير كامل، مشي غير اللون
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
