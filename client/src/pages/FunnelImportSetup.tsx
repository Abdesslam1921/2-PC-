import { useAuth } from "@/_core/hooks/useAuth";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ContactBar } from "@/components/ContactBar";
import { ContentGuard } from "@/components/ContentGuard";
import {
  DirectCodOrderForm,
  StickyCodCta,
} from "@/components/DirectCodOrderForm";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  CreditCard,
  FileImage,
  Image as ImageIcon,
  ImageUp,
  Landmark,
  Loader2,
  MessageSquare,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ImportedMedia = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

const stages = [
  { label: "استيراد تصميمك", icon: Upload },
  { label: "اختر المنتج", icon: Package },
  { label: "الإعدادات الافتراضية", icon: Settings2 },
  { label: "العملة وطريقة الدفع", icon: CreditCard },
  { label: "تفاصيل صفحة الهبوط", icon: FileImage },
];

const fieldClass =
  "w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="مراحل إعداد الفانل" className="mb-7 overflow-x-auto pb-2">
      <ol className="flex min-w-max items-center gap-2 text-xs font-bold">
        <li
          className={`flex items-center gap-2 ${current === 4 ? "text-[var(--brand)]" : current > 4 ? "text-[var(--brand)]" : "text-[#8A938D]"}`}
        >
          <FileImage className="size-4" />
          تفاصيل صفحة الهبوط
        </li>
        <ChevronLeft className="size-4 text-[#C4C9C0]" />
        {stages
          .slice(0, 4)
          .reverse()
          .map((stage, reverseIndex) => {
            const index = 3 - reverseIndex;
            const Icon = stage.icon;
            const done = current > index;
            const active = current === index;
            return (
              <li
                key={stage.label}
                className={`flex items-center gap-2 ${done ? "text-[var(--brand)]" : active ? "text-[var(--brand)]" : "text-[#8A938D]"}`}
              >
                {done ? (
                  <span className="grid size-4 place-items-center rounded-full bg-[var(--brand-soft)] animate-check-pop">
                    <Check className="size-3" />
                  </span>
                ) : (
                  <Icon className="size-4" />
                )}
                {stage.label}
                {index > 0 && (
                  <ChevronLeft className="mr-2 size-4 text-[#C4C9C0]" />
                )}
              </li>
            );
          })}
      </ol>
    </nav>
  );
}

function UploadZone({
  label,
  size,
  onFiles,
}: {
  label: string;
  size: string;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      onClick={() => ref.current?.click()}
      className="btn-press flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8DCD0] bg-[var(--paper)] px-4 transition duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
    >
      <input
        ref={ref}
        onChange={onFiles}
        accept="image/*,video/mp4,video/webm"
        multiple
        type="file"
        className="hidden"
      />
      <span className="grid size-11 place-items-center rounded-xl border border-[#E7E9E2] bg-white text-[var(--brand)] shadow-soft">
        <ImageUp className="size-5" />
      </span>
      <span className="mt-3 text-xs font-extrabold text-[#1F2A25]">
        {label}
      </span>
      <span className="mt-1 text-[10px] text-[#8A938D]">{size}</span>
    </button>
  );
}

function ToggleRow({
  enabled,
  onChange,
  children,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="btn-press flex w-full items-center justify-between rounded-xl border border-[#E7E9E2] bg-white px-4 py-3 text-right text-sm font-bold text-[#1F2A25] transition duration-200 hover:border-[#BFD3C8]"
    >
      <span>{children}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-[var(--brand)]" : "bg-[#E4E6DE]"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${enabled ? "right-4" : "right-0.5"}`}
        />
      </span>
    </button>
  );
}

export default function FunnelImportSetup() {
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
  const [stage, setStage] = useState(() => {
    const requested = Number(
      new URLSearchParams(window.location.search).get("step")
    );
    return Number.isInteger(requested) &&
      requested >= 0 &&
      requested < stages.length
      ? requested
      : 0;
  });
  const [media, setMedia] = useState<ImportedMedia[]>([]);
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<"cod" | "online">("cod");
  const [language, setLanguage] = useState("ar");
  const [showLandingPreview, setShowLandingPreview] = useState(false);
  const [details, setDetails] = useState({
    announcement: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    privacy: true,
    thankYou: "",
    slug: "",
    delivery: "",
    metaPixel: "",
    tiktokPixel: "",
    snapchatPixel: "",
    productOnly: false,
    hideOtherStores: false,
  });
  const selectedProduct = products.find(
    product => String(product.id) === productId
  );
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(search.trim().toLowerCase())
  );
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const additions = Array.from(event.target.files ?? [])
      .filter(
        file => file.type.startsWith("image/") || file.type.startsWith("video/")
      )
      .map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        url: URL.createObjectURL(file),
        kind: file.type.startsWith("video/")
          ? ("video" as const)
          : ("image" as const),
      }));
    if (additions.length) setMedia(current => [...current, ...additions]);
    event.target.value = "";
  };
  const removeMedia = (id: string) =>
    setMedia(current => current.filter(item => item.id !== id));
  const updateDetail = (key: keyof typeof details, value: string | boolean) =>
    setDetails(current => ({ ...current, [key]: value }));
  const next = () => {
    if (stage === 0 && media.length === 0) {
      toast.error("أضف صورة أو فيديو واحدًا على الأقل لمعاينة التصميم.");
      return;
    }
    if (stage === 1 && !selectedProduct) {
      toast.error("اختر منتجًا قبل المتابعة.");
      return;
    }
    if (stage === stages.length - 1) {
      setShowLandingPreview(true);
      return;
    }
    setStage(current => current + 1);
  };
  const previous = () =>
    stage > 0 ? setStage(current => current - 1) : setLocation("/funnels");

  if (showLandingPreview && selectedProduct)
    return (
      <div dir="rtl" className="mx-auto w-full max-w-md pb-24">
        <div className="mb-5 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setShowLandingPreview(false)}
            className="btn-press rounded-xl border-[#D8DCD0] bg-white text-[#1F2A25] hover:bg-[var(--paper)]"
          >
            <ArrowRight className="ml-2 size-4" />
            العودة للتعديل
          </Button>
          <p className="text-xs font-extrabold text-[var(--brand)]">
            معاينة التصميم المرفوع
          </p>
        </div>
        <main className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft animate-fade-up">
          {media.map(item => (
            <section key={item.id} className="relative bg-[#182420]">
              {item.kind === "video" ? (
                <video src={item.url} controls className="w-full" />
              ) : (
                <img
                  src={item.url}
                  alt="تصميم صفحة الهبوط المرفوع"
                  className="w-full"
                />
              )}
            </section>
          ))}
          <section className="bg-[var(--paper)] p-5">
            <DirectCodOrderForm
              formId="import-cod-order"
              productId={selectedProduct.id}
              productTitle={selectedProduct.title}
              price={
                selectedProduct.price ?? selectedProduct.variants[0]?.price
              }
              productImageUrl={selectedProduct.images[0]?.url}
              maxQuantity={
                selectedProduct.trackInventory &&
                !selectedProduct.continueSelling
                  ? selectedProduct.inventory
                  : 50
              }
            />
          </section>
        </main>
        <ContentGuard productId={selectedProduct.id} />
        <ContactBar productId={selectedProduct.id} surface="landing" />
        <StickyCodCta
          targetId="import-cod-order"
          label="اطلب الآن · الدفع عند الاستلام"
        />
      </div>
    );

  const stageContent = [
    <section
      key="import"
      className="grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)]"
    >
      <aside className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
        <h2 className="text-lg font-extrabold text-[#1F2A25]">المعاينة</h2>
        <div className="mt-4 flex min-h-95 items-center justify-center overflow-hidden rounded-[20px] border border-[#ECEAE0] bg-[var(--paper)]">
          <div className="w-44 overflow-hidden rounded-[20px] border border-[#E7E9E2] bg-white shadow-soft">
            {media[0] ? (
              media[0].kind === "video" ? (
                <video
                  src={media[0].url}
                  className="aspect-[9/16] w-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={media[0].url}
                  alt="معاينة التصميم"
                  className="aspect-[9/16] w-full object-cover"
                />
              )
            ) : (
              <div className="grid aspect-[9/16] place-items-center text-center text-[#8A938D]">
                <div>
                  <ImageIcon className="mx-auto size-7" />
                  <p className="mt-3 text-xs">اختر ملفات للمعاينة</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
      <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
        <h2 className="text-lg font-extrabold text-[#1F2A25]">
          استيراد التصميم
        </h2>
        <p className="mt-2 text-xs leading-5 text-[#79837D]">
          أضف لقطات التصميم أو فيديو يوضح الصفحة. استخدم صورة بعرض 1000px على
          الأقل لأفضل نتيجة.
        </p>
        <div className="mt-5">
          <UploadZone
            label="أضف صورًا أو فيديوهات"
            size="PNG · JPG · WEBP · MP4 · WEBM"
            onFiles={onUpload}
          />
        </div>
        {media.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map(item => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-[#E7E9E2] bg-[var(--paper)] transition duration-200 hover:shadow-soft"
              >
                {item.kind === "video" ? (
                  <video
                    src={item.url}
                    className="aspect-square w-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="aspect-square w-full object-cover"
                  />
                )}
                <button
                  onClick={() => removeMedia(item.id)}
                  aria-label={`حذف ${item.file.name}`}
                  className="btn-press absolute left-2 top-2 grid size-7 place-items-center rounded-lg bg-white text-[#A63D28] shadow-soft"
                >
                  <X className="size-4" />
                </button>
                <p className="truncate px-2 py-1.5 text-[10px] font-bold text-[#79837D]">
                  {item.file.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>,
    <section key="product" className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-[#1F2A25]">اختر المنتج</h2>
        <p className="mt-2 text-sm text-[#79837D]">
          اختر منتجًا واحدًا للبيع، وستظهر جميع تفاصيله في صفحة الهبوط.
        </p>
      </div>
      <div className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft">
        <label className="flex h-12 items-center gap-3 border-b border-[#ECEAE0] px-4 text-[#8A938D]">
          <Search className="size-5" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="البحث عن المنتجات..."
            className="w-full bg-transparent text-sm text-[#1F2A25] outline-none"
          />
        </label>
        {productsQuery.isLoading ? (
          <div className="grid h-56 place-items-center">
            <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
          </div>
        ) : filteredProducts.length ? (
          filteredProducts.map(product => {
            const chosen = String(product.id) === productId;
            return (
              <button
                key={product.id}
                onClick={() => setProductId(String(product.id))}
                className={`flex w-full items-center justify-between border-b border-[#F0EFE7] px-5 py-3 text-right transition duration-200 last:border-b-0 ${chosen ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--paper)]"}`}
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-12 overflow-hidden rounded-full bg-[var(--brand-soft)]">
                    {product.images[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Package className="m-auto size-5 text-[var(--brand)]" />
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-[#1F2A25]">
                      {product.title}
                    </span>
                    <span className="mt-1 block text-xs text-[#79837D]">
                      {product.price ?? product.variants[0]?.price ?? "0.00"} دج
                    </span>
                  </span>
                </span>
                <span
                  className={`grid size-5 place-items-center rounded-full border transition ${chosen ? "border-[var(--brand)] bg-[var(--brand)] text-white animate-check-pop" : "border-[#C4C9C0]"}`}
                >
                  {chosen && <Check className="size-3" />}
                </span>
              </button>
            );
          })
        ) : (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title="لا توجد منتجات مطابقة."
              description="جرّب كلمة بحث مختلفة أو أضف منتجًا جديدًا من الكتالوج."
            />
          </div>
        )}
      </div>
    </section>,
    <section
      key="defaults"
      className="mx-auto max-w-3xl rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7"
    >
      <div className="mb-6 flex rounded-xl bg-[#F5F6F2] p-1 text-sm font-bold">
        <span className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-[var(--brand)] shadow-soft">
          التفاصيل
        </span>
        <span className="flex-1 px-4 py-2 text-center text-[#8A938D]">
          النموذج
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <UploadZone label="أضف الشعار" size="200×100px" onFiles={onUpload} />
        <UploadZone label="أضف الأيقونة" size="100×100px" onFiles={onUpload} />
      </div>
      <div className="mt-6 space-y-4">
        <label className="block text-sm font-bold text-[#1F2A25]">
          شريط الإعلان
          <input
            value={details.announcement}
            onChange={event => updateDetail("announcement", event.target.value)}
            placeholder="شريط الإعلان"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-bold text-[#1F2A25]">
            رابط إنستغرام
            <input
              value={details.instagram}
              onChange={event => updateDetail("instagram", event.target.value)}
              placeholder="instagram.com/..."
              className={`mt-2 h-11 text-xs ${fieldClass}`}
            />
          </label>
          <label className="text-sm font-bold text-[#1F2A25]">
            رابط فيسبوك
            <input
              value={details.facebook}
              onChange={event => updateDetail("facebook", event.target.value)}
              placeholder="facebook.com/..."
              className={`mt-2 h-11 text-xs ${fieldClass}`}
            />
          </label>
          <label className="text-sm font-bold text-[#1F2A25]">
            رابط تيك توك
            <input
              value={details.tiktok}
              onChange={event => updateDetail("tiktok", event.target.value)}
              placeholder="tiktok.com/@..."
              className={`mt-2 h-11 text-xs ${fieldClass}`}
            />
          </label>
        </div>
        <ToggleRow
          enabled={details.privacy}
          onChange={value => updateDetail("privacy", value)}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--brand)]" />
            سياسة الخصوصية
          </span>
        </ToggleRow>
        <label className="block text-sm font-bold text-[#1F2A25]">
          رابط صفحة الشكر
          <input
            value={details.thankYou}
            onChange={event => updateDetail("thankYou", event.target.value)}
            placeholder="/thank-you"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
      </div>
    </section>,
    <section key="payment" className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-[#1F2A25]">
          العملة وطريقة الدفع
        </h2>
        <p className="mt-2 text-sm text-[#79837D]">
          اختر العملة وطريقة الدفع لهذا الفانل.
        </p>
      </div>
      <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-6 shadow-soft">
        <p className="text-sm font-extrabold text-[#1F2A25]">
          اختر طريقة الدفع
        </p>
        <p className="mt-1 text-xs text-[#8A938D]">
          يمكنك تعديل الإعدادات لاحقًا.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["cod", "الدفع عند الاستلام", Landmark],
              ["online", "الدفع الإلكتروني", CreditCard],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setPayment(value)}
              className={`btn-press flex h-13 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition duration-200 ${payment === value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[#E3E1D8] text-[#79837D] hover:border-[#BFD3C8]"}`}
            >
              <Icon className="size-5" />
              {label}
              <span
                className={`mr-1 grid size-4 place-items-center rounded-full border transition ${payment === value ? "border-[var(--brand)] bg-[var(--brand)] text-white animate-check-pop" : "border-[#C4C9C0]"}`}
              >
                {payment === value && <Check className="size-3" />}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-sm font-extrabold text-[#1F2A25]">العملة</p>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3">
          <span className="text-sm font-bold text-[#1F2A25]">
            الجزائر · د.ج
          </span>
          <span className="text-xs font-bold text-[var(--brand)]">🇩🇿</span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#F0E3CF] bg-[var(--warm-soft)] px-3 py-2 text-xs text-[#7A5B34]">
          <MessageSquare className="size-4 shrink-0 text-[var(--warm)]" />
          خيارات الدفع الإلكتروني ستُجهّز لاحقًا عند ربط بوابة الدفع.
        </div>
      </div>
    </section>,
    <section
      key="details"
      className="mx-auto max-w-3xl rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7"
    >
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-[#1F2A25]">
          تفاصيل صفحة الهبوط
        </h2>
        <p className="mt-2 text-sm text-[#79837D]">
          خصص اللمسات النهائية لفانلك.
        </p>
      </div>
      <p className="text-sm font-extrabold text-[#1F2A25]">
        اختر اللغة الافتراضية
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(
          [
            ["ar", "العربية 🇩🇿"],
            ["fr", "Français 🇫🇷"],
            ["en", "English 🇺🇸"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setLanguage(value)}
            className={`btn-press rounded-xl border px-4 py-2 text-sm font-bold transition duration-200 ${language === value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[#E3E1D8] text-[#79837D] hover:border-[#BFD3C8]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-5">
        <label className="text-sm font-bold text-[#1F2A25]">
          العنوان *
          <input
            value={selectedProduct?.title ?? ""}
            readOnly
            className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-[var(--paper)] px-3 text-sm text-[#79837D]"
          />
        </label>
        <label className="text-sm font-bold text-[#1F2A25]">
          مسار الرابط *
          <div className="mt-2 flex h-11 items-center overflow-hidden rounded-xl border border-[#E3E1D8] bg-white transition focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
            <span className="shrink-0 border-l border-[#E3E1D8] px-3 text-xs text-[var(--brand)]">
              abdou-store.local/
            </span>
            <input
              value={details.slug}
              onChange={event => updateDetail("slug", event.target.value)}
              placeholder="مسار الرابط"
              className="w-full px-3 text-sm text-[#1F2A25] outline-none"
            />
          </div>
        </label>
        <label className="text-sm font-bold text-[#1F2A25]">
          سعر التوصيل
          <select
            value={details.delivery}
            onChange={event => updateDetail("delivery", event.target.value)}
            className={`mt-2 h-11 ${fieldClass}`}
          >
            <option value="">اختر سعر التوصيل</option>
            <option value="free">توصيل مجاني</option>
            <option value="500">500 دج</option>
            <option value="حسب الولاية">حسب الولاية</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#1F2A25]">
          Meta Pixel
          <input
            value={details.metaPixel}
            onChange={event => updateDetail("metaPixel", event.target.value)}
            placeholder="أدخل مفتاح Meta Pixel"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
        <label className="text-sm font-bold text-[#1F2A25]">
          TikTok Pixel
          <input
            value={details.tiktokPixel}
            onChange={event => updateDetail("tiktokPixel", event.target.value)}
            placeholder="أدخل مفتاح TikTok Pixel"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
        <label className="text-sm font-bold text-[#1F2A25]">
          Snapchat Pixel
          <input
            value={details.snapchatPixel}
            onChange={event =>
              updateDetail("snapchatPixel", event.target.value)
            }
            placeholder="أدخل مفتاح Snapchat Pixel"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </label>
      </div>
      <div className="mt-7 space-y-3">
        <ToggleRow
          enabled={details.productOnly}
          onChange={value => updateDetail("productOnly", value)}
        >
          استخدم وصف المنتج فقط
        </ToggleRow>
        <ToggleRow
          enabled={details.hideOtherStores}
          onChange={value => updateDetail("hideOtherStores", value)}
        >
          إظهار قسم المنتجات الأخرى لهذا المتجر
        </ToggleRow>
      </div>
    </section>,
  ][stage];

  return (
    <div className="funnel-import-setup mx-auto w-full min-w-0 max-w-6xl pb-24">
      <PageIntro
        eyebrow="الفانل · التصميم المرفوع"
        title="إعداد التصميم الخاص"
        description="استورد تصميمك ثم جهّزه كصفحة هبوط متكاملة مع المنتج والطلب والدفع."
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
      <Stepper current={stage} />
      <div className="animate-fade-up">{stageContent}</div>
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E7E9E2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={previous}
            className="btn-press rounded-xl border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            السابق
          </Button>
          <Button
            onClick={next}
            className="btn-press rounded-xl bg-[var(--brand)] px-6 shadow-cta hover:bg-[var(--brand-strong)]"
          >
            {stage === stages.length - 1 ? "إنشاء" : "التالي"}
            <ArrowLeft className="mr-2 size-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
