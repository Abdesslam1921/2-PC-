import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  FileWarning,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ContactBar } from "@/components/ContactBar";
import { ContentGuard } from "@/components/ContentGuard";
import {
  DirectCodOrderForm,
  StickyCodCta,
} from "@/components/DirectCodOrderForm";
import { SharkCodExitPopup } from "@/components/SharkCodExitPopup";
import type { SharkCodExitPopupHandle } from "@/components/SharkCodExitPopup";
import { trpc } from "@/lib/trpc";
import { loadConfiguredPixels, PixelIds } from "@/lib/pixels";
import { toast } from "sonner";

type DesignSystem = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundTone: string;
  visualMood: string;
};
type LandingAsset = {
  landingSectionId: number | null;
  kind: string;
  sourceUrl: string;
};

function parseDesignSystem(raw: string | null): DesignSystem {
  try {
    return JSON.parse(raw ?? "{}") as DesignSystem;
  } catch {
    return {
      primaryColor: "#7A5C2E",
      secondaryColor: "#20150D",
      accentColor: "#E7C671",
      backgroundTone: "دافئ",
      visualMood: "فاخر",
    };
  }
}

function parsePixelIds(raw: string | null): PixelIds {
  try {
    const settings = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    return {
      meta:
        typeof settings.metaPixelId === "string"
          ? settings.metaPixelId
          : typeof settings.meta === "string"
            ? settings.meta
            : undefined,
      tiktok:
        typeof settings.tiktokPixelId === "string"
          ? settings.tiktokPixelId
          : typeof settings.tiktok === "string"
            ? settings.tiktok
            : undefined,
      snapchat:
        typeof settings.snapchatPixelId === "string"
          ? settings.snapchatPixelId
          : typeof settings.snapchat === "string"
            ? settings.snapchat
            : undefined,
    };
  } catch {
    return {};
  }
}

function parseBullets(raw: string) {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

type MicroCommitment = {
  question: string;
  options: string[];
  ctaLabel: string | null;
};

function parseMicroCommitment(raw: string | null): MicroCommitment | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MicroCommitment> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const question =
      typeof parsed.question === "string" ? parsed.question.trim() : "";
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .filter(
            (option): option is string =>
              typeof option === "string" && Boolean(option.trim())
          )
          .map(option => option.trim())
      : [];
    if (!question || options.length < 2) return null;
    return {
      question,
      options: options.slice(0, 4),
      ctaLabel:
        typeof parsed.ctaLabel === "string" && parsed.ctaLabel.trim()
          ? parsed.ctaLabel.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export default function LandingPreview() {
  const [, params] = useRoute("/funnels/ai/preview/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const utils = trpc.useUtils();
  const pageQuery = trpc.landings.get.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0 }
  );
  const productQuery = trpc.products.publicGet.useQuery(
    { id: pageQuery.data?.productId ?? 0 },
    { enabled: Boolean(pageQuery.data?.productId) }
  );
  const [variantId, setVariantId] = useState<number | undefined>();
  const [commitChoice, setCommitChoice] = useState<string | null>(null);
  const [sharkDiscount, setSharkDiscount] = useState(0);
  const exitPopupRef = useRef<SharkCodExitPopupHandle | null>(null);
  const regenerate = trpc.landings.regenerateScenes.useMutation({
    onSuccess: async () => {
      await utils.landings.get.invalidate({ id });
      toast.success("تم إنشاء مشاهد إعلانية جديدة للمسودة.");
    },
    onError: error => toast.error(error.message),
  });
  const approve = trpc.landings.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.landings.get.invalidate({ id }),
        utils.landings.list.invalidate(),
      ]);
      toast.success("تم اعتماد الفانل وحفظه في السجل.");
      setLocation("/funnels");
    },
    onError: error => toast.error(error.message),
  });
  const scrollToOrder = () =>
    document
      .getElementById("landing-cod-order")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pixelIds = pageQuery.data
    ? parsePixelIds(pageQuery.data.settingsJson)
    : {};
  useEffect(() => {
    loadConfiguredPixels(pixelIds);
  }, [pixelIds.meta, pixelIds.tiktok, pixelIds.snapchat]);
  if (pageQuery.isLoading)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
      </div>
    );
  if (!pageQuery.data)
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={FileWarning}
          title="المسودة غير متاحة"
          description="ربما حُذفت المسودة أو أن الرابط غير صحيح. يمكنك إنشاء صفحة جديدة في أي وقت."
          action={
            <Button
              onClick={() => setLocation("/funnels/ai")}
              className="btn-press rounded-xl bg-[var(--brand)] shadow-cta hover:bg-[var(--brand-strong)]"
            >
              العودة لإعداد AI
            </Button>
          }
        />
      </div>
    );

  const page = pageQuery.data;
  const design = parseDesignSystem(page.designSystemJson);
  const assets = page.assets as LandingAsset[];
  const originalProduct =
    assets.find(asset => asset.kind === "original_product")?.sourceUrl ??
    page.sections[0]?.productImageUrl;
  const sectionScenes = new Map(
    assets
      .filter(asset => asset.kind === "composition" && asset.landingSectionId)
      .map(asset => [asset.landingSectionId, asset.sourceUrl])
  );
  const product = productQuery.data;
  const variants =
    product?.variants.filter(
      variant =>
        variant.available &&
        (variant.stock > 0 ||
          product.continueSelling ||
          !product.trackInventory)
    ) ?? [];
  const selectedVariant =
    variants.find(variant => variant.id === variantId) ?? variants[0];
  const price = selectedVariant?.price ?? product?.price;
  const microCommitment = parseMicroCommitment(
    page.sections[page.sections.length - 1]?.microCommitmentJson ?? null
  );
  const commitmentPending = Boolean(
    product && microCommitment && !commitChoice
  );
  const commitChoose = (option: string) => {
    setCommitChoice(option);
    const normalized = option.trim().toLowerCase();
    const matched = variants.find(variant =>
      [variant.color, variant.size].filter(Boolean).some(label => {
        const value = String(label).trim().toLowerCase();
        return (
          value === normalized ||
          value.includes(normalized) ||
          normalized.includes(value)
        );
      })
    );
    if (matched) setVariantId(matched.id);
  };

  return (
    <>
      <div className="mx-auto max-w-5xl pb-24">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold text-[var(--brand)]">
              <Eye className="size-4" />
              {page.approvedAt
                ? "فانل محفوظ ومعتمد"
                : "معاينة خاصة · غير محفوظة"}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#1F2A25]">
              {page.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {page.approvedAt ? (
              <Button
                variant="outline"
                onClick={() => setLocation("/funnels")}
                className="btn-press rounded-xl border-[#CBE0D5] bg-[var(--brand-soft)] text-[var(--brand-strong)] hover:bg-[#DDEAE2]"
              >
                <CheckCircle2 className="ml-2 size-4" />
                محفوظ في السجل
              </Button>
            ) : (
              <Button
                disabled={approve.isPending}
                onClick={() => approve.mutate({ id })}
                className="btn-press rounded-xl bg-[var(--brand)] shadow-cta hover:bg-[var(--brand-strong)]"
              >
                {approve.isPending ? (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="ml-2 size-4" />
                )}
                {approve.isPending ? "جارٍ الحفظ…" : "اعتماد وحفظ الفانل"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutate({ id })}
              className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
            >
              {regenerate.isPending ? (
                <Loader2 className="ml-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="ml-2 size-4 text-[var(--brand)]" />
              )}
              {regenerate.isPending
                ? "جارٍ بناء المشاهد…"
                : "إعادة توليد المشاهد"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/funnels/ai")}
              className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
            >
              <ArrowRight className="ml-2 size-4" />
              إعداد صفحة جديدة
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft animate-fade-up">
          <div className="border-b border-[#ECEAE0] bg-[var(--paper)] px-5 py-3 text-center text-xs font-bold text-[#79837D]">
            نظام التصميم المستخرج: {design.visualMood} · {design.backgroundTone}
          </div>
          <main
            dir="rtl"
            className="mx-auto max-w-md overflow-hidden bg-[#182420] shadow-[0_0_0_1px_rgba(0,0,0,.04)]"
          >
            {page.sections.map(section => {
              const scene = sectionScenes.get(section.id);
              const bullets = parseBullets(section.bulletsJson);
              const fallback = !scene && originalProduct;
              return (
                <section
                  key={section.id}
                  className="relative isolate min-h-[500px] overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${design.secondaryColor}, ${design.primaryColor})`,
                  }}
                >
                  {scene ? (
                    <img
                      src={scene}
                      alt="مشهد إعلاني مولد للمنتج"
                      className="absolute inset-0 -z-10 size-full object-cover"
                    />
                  ) : fallback ? (
                    <img
                      src={fallback}
                      alt={page.title}
                      className="absolute inset-0 -z-10 size-full object-contain p-8 opacity-90"
                    />
                  ) : null}
                  <div className="absolute inset-x-0 top-0 -z-10 h-[48%] bg-gradient-to-b from-black/80 via-black/48 to-transparent" />
                  <div className="absolute inset-x-4 top-4 z-10 max-w-[85%] rounded-2xl border border-white/15 bg-black/24 p-4 text-right shadow-[0_12px_30px_rgba(0,0,0,.18)] backdrop-blur-[2px]">
                    <p
                      className="text-[10px] font-extrabold tracking-[.13em]"
                      style={{ color: design.accentColor }}
                    >
                      {section.eyebrow ?? section.aidaStage.toUpperCase()}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-[1.3] text-white">
                      {section.headline}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/90">
                      {section.body}
                    </p>
                    {bullets.length > 0 && (
                      <ul className="mt-3 space-y-1.5 text-right text-xs font-bold text-white/95">
                        {bullets.slice(0, 3).map((bullet, bulletIndex) => (
                          <li
                            key={bulletIndex}
                            className="flex items-start gap-2"
                          >
                            <Sparkles
                              className="mt-0.5 size-3.5 shrink-0"
                              style={{ color: design.accentColor }}
                            />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.ctaLabel && (
                      <button
                        onClick={scrollToOrder}
                        className="btn-press mt-4 rounded-xl px-5 py-3 text-sm font-extrabold text-[#21160E] shadow-lg transition active:scale-[0.98]"
                        style={{ backgroundColor: design.accentColor }}
                      >
                        {section.ctaLabel}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
            <section className="bg-[var(--paper)] p-5 sm:p-6">
              {product ? (
                <div id="landing-cod-order" className="scroll-mt-24 space-y-4">
                  {microCommitment && (
                    <div
                      className={`overflow-hidden rounded-[24px] border transition-colors duration-300 ${
                        commitChoice
                          ? "border-[#D8E4DC] bg-white shadow-soft"
                          : "border-[#F0E3CF] bg-[var(--warm-soft)]"
                      }`}
                    >
                      {commitChoice ? (
                        <div className="flex flex-wrap items-center gap-3 p-4">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white">
                            <Check className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-[#1F2A25]">
                              {microCommitment.question}
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-[var(--brand-strong)]">
                              اخترت: {commitChoice}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCommitChoice(null)}
                            className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8DCD0] bg-white px-3 py-2 text-xs font-extrabold text-[#41564B] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                          >
                            <RefreshCw className="size-3.5" />
                            تغيير
                          </button>
                        </div>
                      ) : (
                        <div className="p-5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-[#A35A16] shadow-soft">
                            <Sparkles className="size-3" />
                            خطوة سريعة قبل تأكيد الطلب
                          </span>
                          <h3 className="mt-3 text-base font-extrabold text-[#1F2A25]">
                            {microCommitment.question}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {microCommitment.options.map(option => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => commitChoose(option)}
                                className="btn-press rounded-xl border border-[#E7E5DC] bg-white px-4 py-2.5 text-sm font-extrabold text-[#2E3833] transition duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          <p className="mt-3 text-[11px] font-bold text-[#8A7B66]">
                            اختيارك يجهّز طلبك فقط — لن يُرسل أي شيء قبل تأكيدك.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!commitmentPending && (
                    <>
                      {variants.length > 0 && (
                        <div className="mb-1">
                          <p className="text-sm font-extrabold text-[#1F2A25]">
                            اختر الخيار
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {variants.map(variant => (
                              <button
                                key={variant.id}
                                onClick={() => setVariantId(variant.id)}
                                className={`btn-press rounded-xl border px-3 py-2 text-xs font-extrabold transition duration-200 ${selectedVariant?.id === variant.id ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[#E3E1D8] bg-white text-[#79837D] hover:border-[#BFD3C8]"}`}
                              >
                                {[variant.color, variant.size]
                                  .filter(Boolean)
                                  .join(" · ") || "الخيار الأساسي"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <DirectCodOrderForm
                        formId="landing-order-form"
                        productId={product.id}
                        variantId={selectedVariant?.id}
                        productTitle={product.title}
                        price={price}
                        productImageUrl={originalProduct ?? undefined}
                        accentColor={design.primaryColor}
                        pixelIds={pixelIds}
                        landingPageId={page.id}
                        discountPercent={sharkDiscount || undefined}
                        maxQuantity={
                          product.trackInventory && !product.continueSelling
                            ? (selectedVariant?.stock ?? product.inventory)
                            : 50
                        }
                        submitLabel={
                          commitChoice && microCommitment?.ctaLabel
                            ? microCommitment.ctaLabel
                            : undefined
                        }
                        onOrderSuccess={() =>
                          exitPopupRef.current?.deactivate()
                        }
                      />
                    </>
                  )}
                  {commitmentPending && (
                    <p className="rounded-2xl border border-dashed border-[#CFDED3] bg-white/60 p-4 text-center text-xs font-bold text-[#79837D]">
                      أجب على السؤال أعلاه ليظهر نموذج تأكيد الطلب مباشرة.
                    </p>
                  )}
                </div>
              ) : (
                <div
                  id="landing-cod-order"
                  className="rounded-2xl border border-[#E7E9E2] bg-white p-5 text-center text-sm font-bold text-[#79837D]"
                >
                  جارٍ تجهيز نموذج الطلب…
                </div>
              )}
            </section>
          </main>
        </div>
        <p className="mt-4 text-center text-xs text-[#8A938D]">
          الصور متلاصقة لتشكل صفحة واحدة مستمرة، والنسخ تظهر داخل منطقة آمنة
          أعلى المشهد بعيدًا عن المنتج.
        </p>
      </div>
      <ContentGuard productId={page.productId} />
      <ContactBar productId={page.productId} surface="landing" />
      <SharkCodExitPopup
        ref={exitPopupRef}
        productId={page.productId}
        landingPageId={page.id}
        onApplyDiscount={setSharkDiscount}
      />
      <StickyCodCta
        targetId="landing-cod-order"
        label={
          microCommitment
            ? commitChoice
              ? microCommitment.ctaLabel || "أكّد طلبك"
              : "اختر خيارك للطلب"
            : "اطلب الآن · الدفع عند الاستلام"
        }
        accentColor={design.primaryColor}
      />
    </>
  );
}
