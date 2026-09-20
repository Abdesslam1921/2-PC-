import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { Check, Eye, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { MinimalStorefront } from "@/storefront/MinimalStorefront";
import { BoldStorefront } from "@/storefront/BoldStorefront";
import { BoutiqueStorefront } from "@/storefront/BoutiqueStorefront";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

type TemplateKey = "modern" | "minimal" | "bold" | "boutique";

const TEMPLATES: Array<{ key: TemplateKey; label: string; hint: string }> = [
  { key: "modern", label: "Modern", hint: "هيرو بصورة كاملة، بطاقات ناعمة، هوية تيركواز." },
  { key: "minimal", label: "Minimal", hint: "هادئ، حواف حادة، هيرو نصّي، مساحات واسعة." },
  { key: "bold", label: "Bold", hint: "تباين عالٍ، هيرو داكن، حدود سميكة، ذهبي." },
  { key: "boutique", label: "Boutique", hint: "كريمي دافئ، هيرو مقسوم بإطار، لمسات ذهبية." },
];

/** Width of the simulated browser viewport used for the live thumbs. */
const PREVIEW_WIDTH = 1280;
/** Visible slice height (px) of each thumbnail. */
const PREVIEW_HEIGHT = 300;

function TemplateSurface({
  templateKey,
  config,
  storeName,
}: {
  templateKey: TemplateKey;
  config: StorefrontConfig;
  storeName: string;
}) {
  if (templateKey === "minimal") {
    return <MinimalStorefront config={config} storeName={storeName} />;
  }
  if (templateKey === "bold") {
    return <BoldStorefront config={config} storeName={storeName} />;
  }
  if (templateKey === "boutique") {
    return <BoutiqueStorefront config={config} storeName={storeName} />;
  }
  return <ModernStorefront config={config} storeName={storeName} />;
}

/**
 * Real, non-production preview: mounts the actual template component with its
 * default config at a simulated desktop viewport, then scales it down. Same
 * components, tokens and layout rules as the live storefront.
 */
function LiveTemplatePreview({
  templateKey,
  config,
  storeName,
}: {
  templateKey: TemplateKey;
  config: StorefrontConfig;
  storeName: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / PREVIEW_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const themeStyle = useMemo(
    () =>
      ({
        ...templateDefaultTokens(templateKey),
        ...buildStorefrontTokenOverrides(config.theme ?? {}),
        fontFamily: "var(--sf-font-heading, revert-layer)",
      }) as CSSProperties,
    [templateKey, config]
  );

  return (
    <div
      ref={boxRef}
      dir="rtl"
      className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-[rgba(15,118,110,0.16)] bg-white"
    >
      <div
        data-sf-root
        style={{
          ...themeStyle,
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT / scale,
          transform: `scale(${scale})`,
          transformOrigin: "top right",
        }}
        className="pointer-events-none absolute right-0 top-0 select-none"
      >
        <TemplateSurface
          templateKey={templateKey}
          config={config}
          storeName={storeName}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.92))]" />
    </div>
  );
}

export default function Templates() {
  const [, setLocation] = useLocation();
  const storefrontManaged = trpc.storefront.managed.useQuery();
  const templateDefaults = trpc.storefront.templateDefaults.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const activeStore = trpc.stores.active.useQuery(undefined, { retry: false });
  const storeName = activeStore.data?.name || "المتجر";

  const enableTemplate = trpc.storefront.enableTemplate.useMutation({
    onSuccess: data => {
      if (data.alreadyActive) {
        toast.message(`قالب ${data.templateKey} مفعّل بالفعل — لم يتغيّر شيء.`);
      } else {
        toast.success(`تم تفعيل قالب ${data.templateKey} ونشره على واجهة المتجر.`);
      }
      void storefrontManaged.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const startEditing = trpc.storefront.startEditing.useMutation();
  const openEditor = (templateKey: TemplateKey) =>
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
            /* ignore storage failures */
          }
          if (data.seededFrom === "published") {
            toast.message("تم فتح التصميم المنشور للقالب.");
          }
          setLocation("/store/editor");
        },
        onError: error => toast.error(error.message),
      }
    );

  const publishedKey = storefrontManaged.data?.published?.templateKey ?? null;
  const publishedLabel =
    TEMPLATES.find(t => t.key === publishedKey)?.label ?? publishedKey;
  const publishedVersion = storefrontManaged.data?.published?.versionNumber;

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-[rgba(15,118,110,0.18)] bg-[linear-gradient(180deg,#f7fbfa,#ffffff)] p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--brand)]">
            <LayoutTemplate className="size-4" /> مركز القوالب
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#181a2b]">
            اختر تصميم متجرك
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#73758a]">
            أربعة قوالب بهويات بصرية مختلفة. المعاينة أدناه تعرض القالب الحقيقي
            ببيانات متجرك. فعّل التصميم أو افتح المحرّر لتخصيص المحتوى والثيم.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[rgba(15,118,110,0.25)] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[#181a2b]">
            <span className="size-2 rounded-full bg-[var(--brand)]" />
            {publishedLabel ? (
              <>
                القالب النشط الآن: {publishedLabel}
                {publishedVersion ? (
                  <span className="text-[#73758a]">· الإصدار {publishedVersion}</span>
                ) : null}
              </>
            ) : (
              <span className="text-[#73758a]">لا يوجد قالب منشور بعد</span>
            )}
          </div>
        </div>
        <Button
          onClick={() => setLocation("/templates/ai")}
          className="h-12 rounded-2xl brand-shine cta-gradient px-5 font-extrabold"
        >
          <Sparkles className="ml-2 size-4" />
          إنشاء قالب بالذكاء الاصطناعي
        </Button>
      </div>

      {templateDefaults.isLoading ? (
        <div className="grid place-items-center rounded-[1.7rem] border border-[rgba(15,118,110,0.14)] bg-white py-20 shadow-soft">
          <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {TEMPLATES.map(template => {
            const isPublished = publishedKey === template.key;
            const raw = templateDefaults.data?.[template.key];
            const config = raw as StorefrontConfig | undefined;
            return (
              <Card
                key={template.key}
                className={
                  isPublished
                    ? "relative overflow-hidden rounded-[1.7rem] border-2 border-[var(--brand)] bg-white shadow-soft ring-4 ring-[rgba(15,118,110,0.10)]"
                    : "overflow-hidden rounded-[1.7rem] border-[rgba(15,118,110,0.14)] bg-white shadow-soft"
                }
              >
                <CardContent className="space-y-4 p-4">
                  <div className="relative">
                    {config ? (
                      <LiveTemplatePreview
                        templateKey={template.key}
                        config={config}
                        storeName={storeName}
                      />
                    ) : (
                      <div className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-[rgba(15,118,110,0.25)] bg-[#f7fbfa] text-xs font-bold text-[#73758a]">
                        المعاينة غير متوفرة
                      </div>
                    )}
                    {isPublished ? (
                      <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1.5 text-[11.5px] font-black text-white shadow-[0_10px_24px_-12px_rgba(11,93,87,0.9)]">
                        <Check className="size-3.5" />
                        القالب النشط
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-[#181a2b]">
                          {template.label}
                        </h2>
                        {isPublished ? (
                          <Badge className="rounded-full bg-[#e4f3ef] text-[var(--brand)] hover:bg-[#e4f3ef]">
                            <Check className="ml-1 size-3" />
                            نشط
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-6 text-[#73758a]">
                        {template.hint}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isPublished ? (
                      <Button
                        disabled
                        className="h-10 flex-1 rounded-xl border border-[rgba(15,118,110,0.25)] bg-[#e4f3ef] text-sm font-extrabold text-[var(--brand)] opacity-100"
                      >
                        <Check className="ml-1.5 size-4" />
                        مفعّل
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          enableTemplate.mutate({ templateKey: template.key })
                        }
                        disabled={enableTemplate.isPending}
                        className="h-10 flex-1 rounded-xl brand-shine cta-gradient text-sm font-extrabold"
                      >
                        تفعيل
                      </Button>
                    )}
                    <Button
                      variant={isPublished ? "default" : "outline"}
                      onClick={() => openEditor(template.key)}
                      disabled={startEditing.isPending}
                      className={
                        isPublished
                          ? "h-10 flex-1 rounded-xl brand-shine cta-gradient text-sm font-extrabold"
                          : "h-10 flex-1 rounded-xl text-sm font-extrabold"
                      }
                    >
                      <Eye className="ml-1.5 size-3.5" />
                      تعديل
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
