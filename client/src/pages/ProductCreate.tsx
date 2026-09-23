import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  addOptionValue as appendOptionValue,
  buildVariantDrafts,
  formatVariantLabel,
  removeOptionValue as discardOptionValue,
  type ProductVariantDraft,
} from "@/lib/productDraft";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  ArrowRight,
  FileArchive,
  Box,
  ChevronDown,
  CircleDollarSign,
  Copy,
  ImagePlus,
  Layers3,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  Warehouse,
} from "lucide-react";
import React, { ChangeEvent, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type MediaDraft = { id: string; name: string; url: string; file: File };
type ProductStatus = "draft" | "active";
type CostBatchDraft = {
  id: string;
  quantity: string;
  productCostTotal: string;
  packagingCostTotal: string;
  procurementDeliveryCostTotal: string;
  receivedAt: string;
};

const initialColors = ["أسود", "أبيض"];
const initialSizes = ["S", "M", "L"];
const inputClass =
  "h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-medium text-[#1F2A25] outline-none transition duration-200 placeholder:text-[#A8B0AA] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="mb-2 block text-xs font-extrabold text-[#3D4A43]">
      {children}
      {optional && (
        <span className="mr-1 font-medium text-[#A8B0AA]">(اختياري)</span>
      )}
    </label>
  );
}

function FormCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Box;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-[#1F2A25]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#79837D]">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-medium text-[#1F2A25] outline-none transition duration-200 placeholder:text-[#A8B0AA] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 ${className}`}
    />
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--brand)]">
      {children}
    </span>
  );
}

export default function ProductCreate() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const createProduct = trpc.products.create.useMutation({
    onSuccess: product => {
      toast.success(`تم حفظ «${product.title}» في كتالوج عبدو ستور.`);
      setLocation("/products");
    },
    onError: error =>
      toast.error(error.message || "تعذر حفظ المنتج. حاول مرة أخرى."),
  });
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ProductStatus>("draft");
  const [productKind, setProductKind] = useState<"physical" | "digital">(
    "physical"
  );
  const [currency, setCurrency] = useState("DZD");
  const currencySymbol =
    currency === "EUR" ? "€" : currency === "USD" ? "$" : "دج";
  const [digitalFile, setDigitalFile] = useState<{
    name: string;
    file: File;
  }>();
  const [digitalMaxDownloads, setDigitalMaxDownloads] = useState("5");
  const [digitalLinkValidityHours, setDigitalLinkValidityHours] =
    useState("72");
  const [offers, setOffers] = useState<
    Array<{
      id: string;
      description: string;
      quantity: string;
      price: string;
      maxUses: string;
      freeDelivery: boolean;
    }>
  >([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(() => {
    // Deep link from the categories page: /products/create?categoryId=12
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("categoryId") ?? "";
  });
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  /** Existing store categories (one category per product). */
  const categories = trpc.categories.list.useQuery(undefined, { retry: false });
  const createCategory = trpc.categories.create.useMutation();
  /** Create a category without leaving the product form, then select it. */
  const createCategoryInline = () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("اكتب اسم الفئة.");
      return;
    }
    createCategory.mutate(
      { name },
      {
        onSuccess: async data => {
          await categories.refetch();
          setCategoryId(String(data.id));
          setNewCategoryName("");
          setCreatingCategory(false);
          toast.success("تم إنشاء الفئة.");
        },
        onError: error => toast.error(error.message),
      }
    );
  };
  const [description, setDescription] = useState("");
  const [codTrustScore, setCodTrustScore] = useState("");
  const [codTrustScoreEnabled, setCodTrustScoreEnabled] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPerItem, setCostPerItem] = useState("");
  const [costAccountingMode, setCostAccountingMode] = useState<
    "per_item" | "stock_total"
  >("per_item");
  const [costQuantity, setCostQuantity] = useState("1");
  const [productCostTotal, setProductCostTotal] = useState("");
  const [packagingCostPerItem, setPackagingCostPerItem] = useState("");
  const [packagingCostTotal, setPackagingCostTotal] = useState("");
  const [procurementDeliveryCostPerItem, setProcurementDeliveryCostPerItem] =
    useState("");
  const [procurementDeliveryCostTotal, setProcurementDeliveryCostTotal] =
    useState("");
  const [returnCostPerOrder, setReturnCostPerOrder] = useState("");
  const [returnDeliveryFree, setReturnDeliveryFree] = useState(false);
  const [costBatches, setCostBatches] = useState<CostBatchDraft[]>([]);
  const [sku, setSku] = useState("");
  const [inventory, setInventory] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [showStockThreshold, setShowStockThreshold] = useState("50");
  const [trackInventory, setTrackInventory] = useState(true);
  const [continueSelling, setContinueSelling] = useState(false);
  const [deliveryPricingMode, setDeliveryPricingMode] = useState<
    "fixed" | "carrier" | "manual"
  >("manual");
  const [deliveryCarrierConnectionId, setDeliveryCarrierConnectionId] =
    useState<number | undefined>();
  const carrierConnections = trpc.delivery?.carriers?.useQuery?.() ?? {
    data: [],
  };
  const ecotrackConnections = (carrierConnections.data ?? []).filter(
    item => item.provider === "ecotrack" && item.status === "connected"
  );
  const [hasVariants, setHasVariants] = useState(false);
  const [colors, setColors] = useState(initialColors);
  const [sizes, setSizes] = useState(initialSizes);
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [variants, setVariants] = useState<ProductVariantDraft[]>(() =>
    buildVariantDrafts(initialColors, initialSizes)
  );
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const storeProducts = trpc.products.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const upsellCandidates = (storeProducts.data ?? []).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  );
  const landingPagesQuery = trpc.landings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [upsellEnabled, setUpsellEnabled] = useState(false);
  const [upsellProductId, setUpsellProductId] = useState<number | "">("");
  const [upsellPrice, setUpsellPrice] = useState("");
  const [upsellDiscountAmount, setUpsellDiscountAmount] = useState("");
  const [upsellDiscountPercent, setUpsellDiscountPercent] = useState("");
  const [upsellViewType, setUpsellViewType] = useState<"product" | "landing">(
    "product"
  );
  const [upsellLandingPageId, setUpsellLandingPageId] = useState<number | "">(
    ""
  );
  const [upsellDiscountMode, setUpsellDiscountMode] = useState<
    "fixed_price" | "discount_amount" | "discount_percent"
  >("fixed_price");
  const upsellLandingOptions =
    landingPagesQuery.data?.filter(
      lp => lp.productId === Number(upsellProductId)
    ) ?? [];

  const generatedCount = useMemo(
    () => Math.max(colors.length, 1) * Math.max(sizes.length, 1),
    [colors.length, sizes.length]
  );

  const rebuildVariants = (nextColors: string[], nextSizes: string[]) => {
    const next = buildVariantDrafts(nextColors, nextSizes, basePrice);
    setVariants(current =>
      next.map(
        fresh =>
          current.find(
            variant =>
              variant.color === fresh.color && variant.size === fresh.size
          ) ?? fresh
      )
    );
  };

  const applyVariants = () => {
    rebuildVariants(colors, sizes);
    toast.success(
      `تم إنشاء ${buildVariantDrafts(colors, sizes, basePrice).length} متغيرات قابلة للتعديل.`
    );
  };

  const updateVariant = (
    id: string,
    field: keyof ProductVariantDraft,
    value: string | boolean
  ) => {
    setVariants(current =>
      current.map(variant =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    );
  };

  const removeOptionValue = (kind: "color" | "size", value: string) => {
    if (kind === "color") {
      const next = discardOptionValue(colors, value);
      setColors(next);
      rebuildVariants(next, sizes);
    } else {
      const next = discardOptionValue(sizes, value);
      setSizes(next);
      rebuildVariants(colors, next);
    }
  };

  const addOptionValue = (kind: "color" | "size") => {
    const input = kind === "color" ? colorInput.trim() : sizeInput.trim();
    if (!input) return;
    if (kind === "color") {
      const next = appendOptionValue(colors, input);
      setColors(next);
      rebuildVariants(next, sizes);
      setColorInput("");
    } else {
      const next = appendOptionValue(sizes, input);
      setSizes(next);
      rebuildVariants(colors, next);
      setSizeInput("");
    }
  };

  const handleDigitalFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("الحد الأقصى للملف الرقمي هو 50 ميغابايت.");
      return;
    }
    setDigitalFile({ name: file.name, file });
    event.target.value = "";
  };

  const addOffer = () =>
    setOffers(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "2",
        price: basePrice,
        maxUses: "0",
        freeDelivery: false,
      },
    ]);
  const updateOffer = (
    id: string,
    field: "description" | "quantity" | "price" | "maxUses" | "freeDelivery",
    value: string | boolean
  ) =>
    setOffers(current =>
      current.map(offer =>
        offer.id === id ? { ...offer, [field]: value } : offer
      )
    );

  const handleMediaUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const additions = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    }));
    setMedia(current => [...current, ...additions]);
    event.target.value = "";
  };

  const saveProduct = async () => {
    if (!isAuthenticated) {
      toast.error("سجّل الدخول أولاً لحفظ المنتج في كتالوجك.");
      return;
    }
    if (!title.trim()) {
      toast.error("أضف عنوان المنتج أولاً قبل الحفظ.");
      return;
    }
    const readImage = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("تعذر قراءة الصورة."));
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
        reader.readAsDataURL(file);
      });
    try {
      const uploadedMedia = await Promise.all(
        media.map(async item => ({
          id: item.id,
          fileName: item.name,
          dataUrl: await readImage(item.file),
        }))
      );
      const uploadedDigitalFile =
        productKind === "digital" && digitalFile
          ? {
              fileName: digitalFile.name,
              dataUrl: await readImage(digitalFile.file),
              mimeType: digitalFile.file.type,
              size: digitalFile.file.size,
            }
          : undefined;
      await createProduct.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        codTrustScore: codTrustScoreEnabled ? codTrustScore.trim() || undefined : undefined,
        productType: productKind === "digital" ? "منتج رقمي" : "",
        productKind,
        currency,
        collectionName: "",
        categoryId: categoryId ? Number(categoryId) : null,
        status,
        price: basePrice,
        compareAtPrice,
        costPerItem,
        costAccountingMode,
        costQuantity: Number(costQuantity || 1),
        productCostTotal,
        packagingCostPerItem,
        packagingCostTotal,
        procurementDeliveryCostPerItem,
        procurementDeliveryCostTotal,
        returnCostPerOrder,
        returnDeliveryFree,
        costBatches: costBatches.map(batch => ({
          quantity: Number(batch.quantity || 1),
          productCostTotal: batch.productCostTotal || "0.00",
          packagingCostTotal: batch.packagingCostTotal || "0.00",
          procurementDeliveryCostTotal:
            batch.procurementDeliveryCostTotal || "0.00",
          receivedAt: batch.receivedAt || undefined,
        })),
        sku,
        inventory: Number(inventory || 0),
        lowStockThreshold: Number(lowStockThreshold || 0),
        showStockThreshold: Number(showStockThreshold || 0),
        trackInventory,
        continueSelling,
        deliveryPricingMode,
        deliveryCarrierConnectionId:
          deliveryPricingMode === "carrier"
            ? deliveryCarrierConnectionId
            : undefined,
        media: uploadedMedia,
        offers:
          productKind === "digital"
            ? []
            : offers.map(offer => ({
                description: offer.description,
                quantity: Number(offer.quantity || 1),
                price: offer.price,
                maxUses: Number(offer.maxUses || 0),
                freeDelivery: offer.freeDelivery,
                enabled: true,
              })),
        digitalFile: uploadedDigitalFile,
        digitalMaxDownloads:
          productKind === "digital"
            ? Number(digitalMaxDownloads || 5)
            : undefined,
        digitalLinkValidityHours:
          productKind === "digital"
            ? Number(digitalLinkValidityHours || 72)
            : undefined,
        variants:
          productKind === "digital"
            ? []
            : hasVariants
              ? variants.map(variant => ({
                  color:
                    variant.color === "الخيار الافتراضي" ? "" : variant.color,
                  size: variant.size === "الخيار الافتراضي" ? "" : variant.size,
                  sku: variant.sku,
                  price: variant.price,
                  compareAtPrice: variant.compareAtPrice,
                  stock: Number(variant.stock || 0),
                  lowStockThreshold: Number(variant.lowStockThreshold || 0),
                  showStockThreshold: Number(variant.showStockThreshold || 0),
                  mediaId: variant.mediaId,
                  available: variant.available,
                }))
              : [],
        upsellProductId:
          upsellEnabled && upsellProductId ? Number(upsellProductId) : null,
        upsellViewType:
          upsellEnabled && upsellProductId ? upsellViewType : "product",
        upsellLandingPageId:
          upsellEnabled &&
          upsellProductId &&
          upsellViewType === "landing" &&
          upsellLandingPageId
            ? Number(upsellLandingPageId)
            : null,
        upsellPrice:
          upsellEnabled && upsellDiscountMode === "fixed_price" && upsellPrice
            ? upsellPrice
            : "",
        upsellDiscountAmount:
          upsellEnabled &&
          upsellDiscountMode === "discount_amount" &&
          upsellDiscountAmount
            ? upsellDiscountAmount
            : "",
        upsellDiscountPercent:
          upsellEnabled &&
          upsellDiscountMode === "discount_percent" &&
          upsellDiscountPercent
            ? Number(upsellDiscountPercent)
            : null,
      });
    } catch (error) {
      if (error instanceof Error && !error.message.includes("TRPCClientError"))
        toast.error(error.message);
    }
  };

  return (
    <div>
      <PageIntro
        eyebrow="الكتالوج · منتج جديد"
        title="إضافة منتج"
        description="أدخل تفاصيل المنتج، ثم أضف المتغيرات والأسعار والمخزون. عند الحفظ سيُضاف المنتج مباشرةً إلى كتالوج عبدو ستور المستقل."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/products")}
              className="btn-press h-11 rounded-xl border-[#E3E1D8] bg-white px-4 font-bold text-[#4A554F] transition duration-200 hover:bg-[#F5F6F2]"
            >
              <ArrowRight className="ml-2 size-4" />
              رجوع
            </Button>
            <Button
              disabled={createProduct.isPending}
              onClick={saveProduct}
              className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-bold shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
            >
              <Save className="ml-2 size-4" />
              {createProduct.isPending ? "جارٍ الحفظ..." : "حفظ المنتج"}
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#DCE8E0] bg-[var(--brand-soft)] px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium leading-5 text-[#3E6B58]">
          <Sparkles className="size-4 shrink-0 text-[var(--brand)]" />
          عند الحفظ، تُخزّن بيانات المنتج وصوره ومتغيراته داخل عبدو ستور
          مباشرةً.
        </div>
        <SmallBadge>
          {status === "active" ? "سيظهر في الكتالوج" : "مسودة"}
        </SmallBadge>
      </div>

      <FormCard
        title="نوع المنتج"
        description="اختر إن كان المنتج يحتاج توصيلًا أم يُسلَّم كملف رقمي بعد تأكيد الدفع."
        icon={Archive}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "physical",
                label: "منتج مادي",
                description: "يُطلب مع الولاية والعنوان والتوصيل.",
              },
              {
                value: "digital",
                label: "منتج رقمي",
                description: "تنزيل آمن دون معلومات شحن.",
              },
            ] as const
          ).map(option => (
            <button
              type="button"
              key={option.value}
              onClick={() => setProductKind(option.value)}
              className={`btn-press rounded-2xl border p-4 text-right transition duration-200 ${productKind === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-soft" : "border-[#E7E9E2] bg-white hover:border-[#C8D6CD]"}`}
            >
              <p
                className={`text-sm font-extrabold ${productKind === option.value ? "text-[var(--brand-strong)]" : "text-[#1F2A25]"}`}
              >
                {option.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#79837D]">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </FormCard>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <FormCard
            title="معلومات المنتج"
            description="الاسم والوصف الظاهرَان لعملاء متجرك."
            icon={Box}
          >
            <div className="grid gap-5">
              <div>
                <FieldLabel>عنوان المنتج</FieldLabel>
                <TextInput
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="مثال: تيشيرت قطن أساسي"
                />
              </div>
              <div>
                <FieldLabel>وصف المنتج</FieldLabel>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="اكتب وصفًا واضحًا يشرح الخامة والمميزات والاستخدام."
                  className="min-h-36 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm leading-7 text-[#1F2A25] outline-none transition duration-200 placeholder:text-[#A8B0AA] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel optional>النوع</FieldLabel>
                  <TextInput placeholder="ملابس، إكسسوارات..." />
                </div>
                <div>
                  <FieldLabel optional>الفئة الأساسية</FieldLabel>
                  {creatingCategory ? (
                    <div className="flex items-center gap-2">
                      <TextInput
                        value={newCategoryName}
                        onChange={event => setNewCategoryName(event.target.value)}
                        placeholder="اسم الفئة الجديدة"
                      />
                      <button
                        type="button"
                        onClick={createCategoryInline}
                        disabled={createCategory.isPending}
                        className="h-11 shrink-0 rounded-xl bg-[var(--brand)] px-3 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {createCategory.isPending ? "…" : "إنشاء"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatingCategory(false)}
                        className="h-11 shrink-0 rounded-xl border border-[#E3E1D8] px-3 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <select
                      value={categoryId}
                      onChange={event => {
                        if (event.target.value === "__new__") {
                          setCreatingCategory(true);
                          return;
                        }
                        setCategoryId(event.target.value);
                      }}
                      className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                    >
                      <option value="">بدون فئة</option>
                      {categories.data?.map(category => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name}
                        </option>
                      ))}
                      <option value="__new__">+ إنشاء فئة جديدة</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </FormCard>

          <FormCard
            title="🛡️ COD Trust Score"
            description="Average delivery time by Wilaya — رسالة الثقة التي تظهر للعملاء عند الطلب."
            icon={ShieldCheck}
          >
            <div className="flex flex-col gap-4 rounded-2xl border border-[#E7E9E2] bg-[#F5F6F2] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  تفعيل رسالة ثقة COD؟
                </p>
                <p className="mt-1 text-xs text-[#79837D]">
                  عندما تفعّل هذه الميزة، تظهر للعملاء في صفحة الطلب رسالة تعرض
                  عدد الأشخاص من ولايتهم الذين طلبوا هذا المنتج اليوم.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={codTrustScoreEnabled}
                onClick={() => setCodTrustScoreEnabled(value => !value)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition duration-200 ${codTrustScoreEnabled ? "bg-[var(--brand)]" : "bg-[#D4D8D0]"}`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition duration-200 ${codTrustScoreEnabled ? "right-6" : "right-1"}`}
                />
              </button>
            </div>
            {codTrustScoreEnabled && (
              <div className="mt-4">
                <FieldLabel optional>نص ثقة COD</FieldLabel>
                <TextInput
                  value={codTrustScore}
                  onChange={event => setCodTrustScore(event.target.value)}
                  placeholder="مثال: 7 أشخاص من ولايتك طلبوا هذا المنتج اليوم"
                  maxLength={255}
                />
                <p className="mt-1.5 text-[11px] leading-5 text-[#79837D]">
                  يُعرض هذا النص للعملاء في صفحة الطلب لتعزيز ثقتهم.
                </p>
              </div>
            )}
          </FormCard>

          {productKind === "digital" && (
            <FormCard
              title="ملف المنتج الرقمي"
              description="ارفع الملف الذي سيحصل عليه العميل بعد تأكيد الدفع. يتم حفظه في التخزين الآمن ولا يظهر رابط المصدر في الكتالوج العام."
              icon={FileArchive}
            >
              <input
                ref={digitalFileInputRef}
                type="file"
                accept=".pdf,.zip,.epub,.csv,.json,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.psd,.ai,.sketch,.fig,.ase,.abr,.tpl,.preset,.exe,.dmg,.msi"
                className="hidden"
                onChange={handleDigitalFileUpload}
              />
              <button
                type="button"
                onClick={() => digitalFileInputRef.current?.click()}
                className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D8DCD0] bg-[#FAF9F5] px-6 text-center transition duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <FileArchive className="size-5" />
                </span>
                <span className="mt-3 text-sm font-extrabold text-[#1F2A25]">
                  اختر الملف الرقمي للبيع
                </span>
                <span className="mt-1 text-xs leading-5 text-[#8A938D]">
                  PDF، ZIP، EPUB، Templates، Presets، ملفات التصميم أو Software
                  حتى 50 ميغابايت.
                </span>
              </button>
              {digitalFile && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--brand-soft)] px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#1F2A25]">
                      {digitalFile.name}
                    </p>
                    <p className="mt-1 text-xs text-[#5F7A6D]">
                      جاهز للرفع عند حفظ المنتج
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDigitalFile(undefined)}
                    className="btn-press text-xs font-extrabold text-[#A63D28]"
                  >
                    إزالة
                  </button>
                </div>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>العملة</FieldLabel>
                  <select
                    value={currency}
                    onChange={event => setCurrency(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                  >
                    <option value="DZD">DZD · دج</option>
                    <option value="EUR">EUR · €</option>
                    <option value="USD">USD · $</option>
                  </select>
                </div>
                <div>
                  <FieldLabel optional>عدد مرات التحميل</FieldLabel>
                  <TextInput
                    value={digitalMaxDownloads}
                    onChange={event =>
                      setDigitalMaxDownloads(event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="5"
                  />
                </div>
                <div>
                  <FieldLabel optional>صلاحية الرابط بالساعات</FieldLabel>
                  <TextInput
                    value={digitalLinkValidityHours}
                    onChange={event =>
                      setDigitalLinkValidityHours(event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="72"
                  />
                </div>
              </div>
            </FormCard>
          )}

          <FormCard
            title="صور المنتج والمتغيرات"
            description="أضف صور المنتج ثم اسند صورة مختلفة لكل متغير في القسم التالي. تدعم هذه النسخة صور المنتج كمعاينة محلية."
            icon={ImagePlus}
          >
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleMediaUpload}
            />
            <button
              onClick={() => mediaInputRef.current?.click()}
              className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D8DCD0] bg-[#FAF9F5] px-6 text-center transition duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <Upload className="size-5" />
              </span>
              <span className="mt-3 text-sm font-extrabold text-[#1F2A25]">
                اسحب صور المنتج هنا أو اخترها من جهازك
              </span>
              <span className="mt-1 text-xs leading-5 text-[#8A938D]">
                PNG أو JPG أو WEBP. اختر صورة خاصة بكل متغير من جدول المتغيرات.
              </span>
            </button>
            {media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {media.map(item => (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-[#E7E9E2] bg-[#FAF9F5]"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      onClick={() =>
                        setMedia(current =>
                          current.filter(mediaItem => mediaItem.id !== item.id)
                        )
                      }
                      className="absolute left-2 top-2 grid size-7 place-items-center rounded-lg bg-white/95 text-[#A63D28] shadow-sm opacity-0 transition duration-200 group-hover:opacity-100"
                      aria-label={`حذف ${item.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <p className="truncate px-2 py-1.5 text-[10px] font-bold text-[#79837D]">
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormCard>

          {productKind === "physical" && (
            <FormCard
              title="Costs & Profitability"
              description="إعدادات داخلية يراها صاحب المتجر فقط لحساب الربح الحقيقي لاحقًا. لا تُرسل هذه البيانات إلى واجهة الزبون."
              icon={CircleDollarSign}
            >
              <div className="rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4">
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  طريقة احتساب تكلفة الشراء والتوريد
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCostAccountingMode("per_item")}
                    className={`btn-press rounded-xl border p-3 text-right text-xs font-extrabold transition duration-200 ${costAccountingMode === "per_item" ? "border-[var(--brand)] bg-white text-[var(--brand-strong)] shadow-soft" : "border-[#E7E9E2] text-[#79837D] hover:border-[#C8D6CD]"}`}
                  >
                    تكلفة لكل قطعة
                    <span className="mt-1 block text-[11px] font-medium text-[#8A938D]">
                      أدخل تكلفة وحدة واحدة.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostAccountingMode("stock_total")}
                    className={`btn-press rounded-xl border p-3 text-right text-xs font-extrabold transition duration-200 ${costAccountingMode === "stock_total" ? "border-[var(--brand)] bg-white text-[var(--brand-strong)] shadow-soft" : "border-[#E7E9E2] text-[#79837D] hover:border-[#C8D6CD]"}`}
                  >
                    تكلفة إجمالية للمخزون
                    <span className="mt-1 block text-[11px] font-medium text-[#8A938D]">
                      تُقسم على عدد القطع المشتراة.
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel>
                    {costAccountingMode === "per_item"
                      ? "تكلفة شراء القطعة"
                      : "إجمالي تكلفة الشراء"}
                  </FieldLabel>
                  <div className="relative">
                    <TextInput
                      value={
                        costAccountingMode === "per_item"
                          ? costPerItem
                          : productCostTotal
                      }
                      onChange={event =>
                        costAccountingMode === "per_item"
                          ? setCostPerItem(event.target.value)
                          : setProductCostTotal(event.target.value)
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-12"
                    />
                    <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                      {currencySymbol}
                    </span>
                  </div>
                </div>
                <div>
                  <FieldLabel>عدد القطع المشتراة</FieldLabel>
                  <TextInput
                    value={costQuantity}
                    onChange={event => setCostQuantity(event.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </div>
                <div>
                  <FieldLabel optional>إضافة لاحقة للمخزون</FieldLabel>
                  <p className="rounded-xl bg-[#F5F6F2] px-3 py-3 text-[11px] leading-5 text-[#79837D]">
                    سيتم تسجيل دفعات الشراء الإضافية في مرحلة المخزون مع مصدرها
                    وتكلفتها.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel optional>التغليف لكل قطعة</FieldLabel>
                  <TextInput
                    value={packagingCostPerItem}
                    onChange={event =>
                      setPackagingCostPerItem(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel optional>إجمالي التغليف للمخزون</FieldLabel>
                  <TextInput
                    value={packagingCostTotal}
                    onChange={event =>
                      setPackagingCostTotal(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel optional>توصيل التوريد لكل قطعة</FieldLabel>
                  <TextInput
                    value={procurementDeliveryCostPerItem}
                    onChange={event =>
                      setProcurementDeliveryCostPerItem(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel optional>إجمالي توصيل التوريد</FieldLabel>
                  <TextInput
                    value={procurementDeliveryCostTotal}
                    onChange={event =>
                      setProcurementDeliveryCostTotal(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#1F2A25]">
                      دفعات شراء إضافية
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[#79837D]">
                      أضف دفعة جديدة عند شراء قطع أخرى، لتبقى تكلفة كل دفعة
                      قابلة للتدقيق.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCostBatches(items => [
                        ...items,
                        {
                          id: crypto.randomUUID(),
                          quantity: "1",
                          productCostTotal: "",
                          packagingCostTotal: "",
                          procurementDeliveryCostTotal: "",
                          receivedAt: new Date().toISOString().slice(0, 10),
                        },
                      ])
                    }
                    className="btn-press shrink-0 rounded-xl border-[#E3E1D8] text-xs font-bold"
                  >
                    <Plus className="ml-1 size-3.5" />
                    دفعة
                  </Button>
                </div>
                {costBatches.map((batch, index) => (
                  <div
                    key={batch.id}
                    className="mt-3 rounded-xl border border-[#E7E9E2] bg-white p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <SmallBadge>دفعة {index + 1}</SmallBadge>
                      <button
                        type="button"
                        onClick={() =>
                          setCostBatches(items =>
                            items.filter(item => item.id !== batch.id)
                          )
                        }
                        className="btn-press text-xs font-bold text-[#A63D28]"
                      >
                        حذف
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      <TextInput
                        aria-label={`كمية دفعة ${index + 1}`}
                        value={batch.quantity}
                        onChange={event =>
                          setCostBatches(items =>
                            items.map(item =>
                              item.id === batch.id
                                ? { ...item, quantity: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="القطع"
                        inputMode="numeric"
                      />
                      <TextInput
                        aria-label={`إجمالي شراء دفعة ${index + 1}`}
                        value={batch.productCostTotal}
                        onChange={event =>
                          setCostBatches(items =>
                            items.map(item =>
                              item.id === batch.id
                                ? {
                                    ...item,
                                    productCostTotal: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="إجمالي الشراء"
                        inputMode="decimal"
                      />
                      <TextInput
                        aria-label={`تغليف دفعة ${index + 1}`}
                        value={batch.packagingCostTotal}
                        onChange={event =>
                          setCostBatches(items =>
                            items.map(item =>
                              item.id === batch.id
                                ? {
                                    ...item,
                                    packagingCostTotal: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="إجمالي التغليف"
                        inputMode="decimal"
                      />
                      <TextInput
                        aria-label={`توصيل توريد دفعة ${index + 1}`}
                        value={batch.procurementDeliveryCostTotal}
                        onChange={event =>
                          setCostBatches(items =>
                            items.map(item =>
                              item.id === batch.id
                                ? {
                                    ...item,
                                    procurementDeliveryCostTotal:
                                      event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="توصيل التوريد"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-[#F1DFC6] bg-[var(--warm-soft)] p-4">
                <p className="text-sm font-extrabold text-[#7A4A1B]">
                  تكلفة الروتور
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <FieldLabel optional>التكلفة لكل طلب راجع</FieldLabel>
                    <TextInput
                      value={returnCostPerOrder}
                      onChange={event =>
                        setReturnCostPerOrder(event.target.value)
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-3 text-xs font-bold text-[#8A5A22]">
                    <input
                      type="checkbox"
                      checked={returnDeliveryFree}
                      onChange={event =>
                        setReturnDeliveryFree(event.target.checked)
                      }
                      className="size-4 accent-[#DE7C2A]"
                    />
                    الروتور مجاني
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#A87B4A]">
                  عند تنفيذ ربط الروتور لاحقًا، ستُعاد قطعة الطلب إلى المخزون مع
                  تسجيل أن مصدر الزيادة «طلب راجع».
                </p>
              </div>
            </FormCard>
          )}

          <FormCard
            title="التسعير"
            description="أدخل السعر الحالي وسعر المقارنة لإظهار التخفيض عند الحاجة."
            icon={CircleDollarSign}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <FieldLabel>السعر بعد التخفيض</FieldLabel>
                <div className="relative">
                  <TextInput
                    value={basePrice}
                    onChange={event => setBasePrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-12"
                  />
                  <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                    {currencySymbol}
                  </span>
                </div>
              </div>
              <div>
                <FieldLabel optional>السعر قبل التخفيض</FieldLabel>
                <div className="relative">
                  <TextInput
                    value={compareAtPrice}
                    onChange={event => setCompareAtPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-12"
                  />
                  <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                    {currencySymbol}
                  </span>
                </div>
              </div>
              <div>
                <FieldLabel optional>تكلفة القطعة</FieldLabel>
                <div className="relative">
                  <TextInput
                    value={costPerItem}
                    onChange={event => setCostPerItem(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-12"
                  />
                  <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                    {currencySymbol}
                  </span>
                </div>
              </div>
            </div>
            {compareAtPrice && basePrice && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--brand-soft)] px-3 py-2.5 text-xs font-medium text-[var(--brand)]">
                <CircleDollarSign className="size-4" />
                سيظهر السعر {compareAtPrice} دج كسعر مقارنة بجانب السعر الحالي{" "}
                {basePrice} دج.
              </div>
            )}
          </FormCard>

          {productKind === "physical" && (
            <FormCard
              title="المتغيرات"
              description="أنشئ مجموعات لون وحجم، ثم عدّل السعر والصورة والمخزون لكل متغير على حدة."
              icon={Layers3}
            >
              <div className="flex flex-col gap-4 rounded-2xl bg-[#F5F6F2] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-[#1F2A25]">
                    هل للمنتج متغيرات؟
                  </p>
                  <p className="mt-1 text-xs text-[#79837D]">
                    مثل اللون، الحجم أو أي خيار آخر.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={hasVariants}
                  onClick={() => setHasVariants(value => !value)}
                  className={`relative h-7 w-12 rounded-full transition duration-200 ${hasVariants ? "bg-[var(--brand)]" : "bg-[#D4D8D0]"}`}
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition duration-200 ${hasVariants ? "right-6" : "right-1"}`}
                  />
                </button>
              </div>
              {hasVariants ? (
                <div className="mt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#E7E9E2] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-extrabold text-[#1F2A25]">
                          اللون
                        </p>
                        <SmallBadge>{colors.length} خيارات</SmallBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {colors.map(color => (
                          <button
                            key={color}
                            onClick={() => removeOptionValue("color", color)}
                            className="btn-press inline-flex items-center gap-1 rounded-lg bg-[var(--brand-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--brand-strong)] transition duration-200 hover:bg-[#DDEBE2]"
                          >
                            {color}
                            <span className="mr-1 text-[#7FA292]">×</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <TextInput
                          value={colorInput}
                          onChange={event => setColorInput(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addOptionValue("color");
                            }
                          }}
                          placeholder="أضف لونًا"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          aria-label="إضافة لون"
                          onClick={() => addOptionValue("color")}
                          variant="outline"
                          className="btn-press h-10 shrink-0 rounded-xl border-[#E3E1D8] px-3 font-bold"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#E7E9E2] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-extrabold text-[#1F2A25]">
                          المقاس
                        </p>
                        <SmallBadge>{sizes.length} خيارات</SmallBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sizes.map(size => (
                          <button
                            key={size}
                            onClick={() => removeOptionValue("size", size)}
                            className="btn-press inline-flex items-center gap-1 rounded-lg bg-[var(--brand-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--brand-strong)] transition duration-200 hover:bg-[#DDEBE2]"
                          >
                            {size}
                            <span className="mr-1 text-[#7FA292]">×</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <TextInput
                          value={sizeInput}
                          onChange={event => setSizeInput(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addOptionValue("size");
                            }
                          }}
                          placeholder="أضف مقاسًا"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          aria-label="إضافة مقاس"
                          onClick={() => addOptionValue("size")}
                          variant="outline"
                          className="btn-press h-10 shrink-0 rounded-xl border-[#E3E1D8] px-3 font-bold"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#DCE8E0] bg-[var(--brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-6 text-[#3E6B58]">
                      سيتم إنشاء <strong>{generatedCount}</strong> متغيرات من
                      خيارات اللون والمقاس.
                    </p>
                    <Button
                      type="button"
                      onClick={applyVariants}
                      className="btn-press rounded-xl bg-[var(--brand)] px-4 font-bold shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
                    >
                      <Settings2 className="ml-2 size-4" />
                      تطبيق المتغيرات
                    </Button>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#E7E9E2]">
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full text-right">
                        <thead className="bg-[#F5F6F2] text-[11px] font-extrabold text-[#79837D]">
                          <tr>
                            <th className="px-4 py-3">المتغير</th>
                            <th className="px-4 py-3">الصورة</th>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3">السعر</th>
                            <th className="px-4 py-3">قبل التخفيض</th>
                            <th className="px-4 py-3">المخزون</th>
                            <th className="px-4 py-3">حد التنبيه</th>
                            <th className="px-4 py-3 text-center">متاح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map(variant => {
                            const isLow =
                              trackInventory &&
                              Number(variant.stock || 0) <=
                                Number(variant.lowStockThreshold || 0);
                            return (
                              <tr
                                key={variant.id}
                                className="border-t border-[#EEF0E9] bg-white transition duration-200 hover:bg-[#FAF9F5]"
                              >
                                <td className="px-4 py-3">
                                  <p className="text-xs font-extrabold text-[#1F2A25]">
                                    {formatVariantLabel(variant)}
                                  </p>
                                  {isLow && (
                                    <span className="mt-1 inline-flex rounded-full bg-[var(--warm-soft)] px-2 py-0.5 text-[9px] font-extrabold text-[#B2611C]">
                                      مخزون منخفض
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={variant.mediaId}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "mediaId",
                                        event.target.value
                                      )
                                    }
                                    className="h-9 max-w-35 rounded-lg border border-[#E3E1D8] bg-white px-2 text-[11px] font-bold text-[#4A554F] outline-none transition duration-200 focus:border-[var(--brand)]"
                                  >
                                    {[
                                      { id: "", name: "بدون صورة" },
                                      ...media,
                                    ].map(item => (
                                      <option key={item.id} value={item.id}>
                                        {item.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={variant.sku}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "sku",
                                        event.target.value
                                      )
                                    }
                                    placeholder="SKU"
                                    className="h-9 w-25 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition duration-200 focus:border-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={variant.price}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "price",
                                        event.target.value
                                      )
                                    }
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    className="h-9 w-24 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition duration-200 focus:border-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={variant.compareAtPrice}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "compareAtPrice",
                                        event.target.value
                                      )
                                    }
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    className="h-9 w-24 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition duration-200 focus:border-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={variant.stock}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "stock",
                                        event.target.value
                                      )
                                    }
                                    inputMode="numeric"
                                    className="h-9 w-20 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition duration-200 focus:border-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    value={variant.lowStockThreshold}
                                    onChange={event =>
                                      updateVariant(
                                        variant.id,
                                        "lowStockThreshold",
                                        event.target.value
                                      )
                                    }
                                    inputMode="numeric"
                                    className="h-9 w-20 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition duration-200 focus:border-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <button
                                    role="switch"
                                    aria-checked={variant.available}
                                    onClick={() =>
                                      updateVariant(
                                        variant.id,
                                        "available",
                                        !variant.available
                                      )
                                    }
                                    className={`relative h-6 w-10 rounded-full transition duration-200 ${variant.available ? "bg-[var(--brand)]" : "bg-[#D4D8D0]"}`}
                                  >
                                    <span
                                      className={`absolute top-1 size-4 rounded-full bg-white transition duration-200 ${variant.available ? "right-5" : "right-1"}`}
                                    />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#D8DCD0] bg-[#FAF9F5] p-5 text-center text-sm text-[#79837D]">
                  سيُستخدم السعر والمخزون الأساسيان لمتغير واحد افتراضي.
                </div>
              )}
            </FormCard>
          )}

          {productKind === "physical" && (
            <FormCard
              title="العروض"
              description="أنشئ عرض كمية يحدد الوصف، الكمية، سعر العرض، عدد مرات توفره والتوصيل المجاني."
              icon={CircleDollarSign}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-[#79837D]">
                  اترك عدد العروض 0 ليبقى العرض متاحًا بلا حد، أو حدد عدد
                  الاستخدامات قبل انتهائه.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addOffer}
                  className="btn-press shrink-0 rounded-xl border-[#E3E1D8] font-extrabold"
                >
                  <Plus className="ml-2 size-4" />
                  إضافة عرض
                </Button>
              </div>
              {offers.length > 0 && (
                <div className="mt-4 space-y-3">
                  {offers.map((offer, index) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <SmallBadge>العرض {index + 1}</SmallBadge>
                        <button
                          type="button"
                          onClick={() =>
                            setOffers(current =>
                              current.filter(item => item.id !== offer.id)
                            )
                          }
                          className="btn-press text-xs font-extrabold text-[#A63D28]"
                        >
                          حذف
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <TextInput
                          aria-label={`وصف العرض ${index + 1}`}
                          value={offer.description}
                          onChange={event =>
                            updateOffer(
                              offer.id,
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="مثال: باقة 2 قطع"
                        />
                        <TextInput
                          aria-label={`كمية العرض ${index + 1}`}
                          value={offer.quantity}
                          onChange={event =>
                            updateOffer(
                              offer.id,
                              "quantity",
                              event.target.value
                            )
                          }
                          inputMode="numeric"
                          placeholder="الكمية"
                        />
                        <TextInput
                          aria-label={`سعر العرض ${index + 1}`}
                          value={offer.price}
                          onChange={event =>
                            updateOffer(offer.id, "price", event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="سعر العرض"
                        />
                        <TextInput
                          aria-label={`عدد العروض ${index + 1}`}
                          value={offer.maxUses}
                          onChange={event =>
                            updateOffer(offer.id, "maxUses", event.target.value)
                          }
                          inputMode="numeric"
                          placeholder="عدد العروض · 0 بلا حد"
                        />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#4A554F]">
                        <input
                          type="checkbox"
                          checked={offer.freeDelivery}
                          onChange={event =>
                            updateOffer(
                              offer.id,
                              "freeDelivery",
                              event.target.checked
                            )
                          }
                          className="size-4 accent-[var(--brand)]"
                        />
                        توصيل مجاني لهذا العرض
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </FormCard>
          )}

          {productKind === "physical" && (
            <FormCard
              title="أسعار التوصيل لهذا المنتج"
              description="اختر مصدرًا واحدًا فقط لرسوم التوصيل عند طلب هذا المنتج."
              icon={Truck}
            >
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    { value: "fixed", label: "السعر الثابت" },
                    { value: "carrier", label: "أسعار شركة التوصيل" },
                    { value: "manual", label: "الأسعار اليدوية / الملف" },
                  ] as const
                ).map(option => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setDeliveryPricingMode(option.value)}
                    className={`btn-press rounded-xl border p-3 text-right text-sm font-extrabold transition duration-200 ${deliveryPricingMode === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-soft" : "border-[#E7E9E2] text-[#4A554F] hover:border-[#C8D6CD]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {deliveryPricingMode === "carrier" && (
                <label className="mt-4 block text-xs font-extrabold text-[#3D4A43]">
                  شركة التوصيل
                  <select
                    required
                    value={deliveryCarrierConnectionId ?? ""}
                    onChange={event =>
                      setDeliveryCarrierConnectionId(Number(event.target.value))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                  >
                    <option value="" disabled>
                      {ecotrackConnections.length
                        ? "اختر الشركة المرتبطة"
                        : "لا توجد شركة مرتبطة"}
                    </option>
                    {ecotrackConnections.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.accountName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </FormCard>
          )}

          {productKind === "physical" && (
            <FormCard
              title="المخزون"
              description="تابع الكمية المتاحة أو اترك البيع مستمرًا حتى نفاد المنتج."
              icon={Warehouse}
            >
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <FieldLabel optional>رمز SKU الأساسي</FieldLabel>
                  <TextInput
                    value={sku}
                    onChange={event => setSku(event.target.value)}
                    placeholder="مثال: TS-001"
                  />
                </div>
                <div>
                  <FieldLabel>الكمية المتاحة</FieldLabel>
                  <TextInput
                    value={inventory}
                    onChange={event => setInventory(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel>تنبيه عند انخفاض الكمية</FieldLabel>
                  <TextInput
                    value={lowStockThreshold}
                    onChange={event => setLowStockThreshold(event.target.value)}
                    inputMode="numeric"
                    placeholder="5"
                  />
                </div>
                <div>
                  <FieldLabel>
                    إظهار المخزون للعملاء عند الوصول إلى
                  </FieldLabel>
                  <TextInput
                    value={showStockThreshold}
                    onChange={event => setShowStockThreshold(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[var(--warm-soft)] px-3 py-2.5 text-xs leading-5 text-[#96601F]">
                سيظهر تنبيه مخزون منخفض عندما تصبح الكمية المتاحة مساوية أو أقل
                من {lowStockThreshold || "0"} قطعة. سيظهر المخزون للعملاء عند
                الوصول إلى {showStockThreshold || "0"} قطعة أو أقل. يمكنك تحديد حد
                مستقل لكل متغير.
              </div>
              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E7E9E2] px-4 py-3 transition duration-200 hover:bg-[#FAF9F5]">
                  <span>
                    <span className="block text-sm font-extrabold text-[#1F2A25]">
                      تتبع المخزون
                    </span>
                    <span className="mt-1 block text-xs text-[#8A938D]">
                      حدّث الكمية مع كل عملية بيع عندما يصبح الربط حيًا.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={trackInventory}
                    onChange={event => setTrackInventory(event.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E7E9E2] px-4 py-3 transition duration-200 hover:bg-[#FAF9F5]">
                  <span>
                    <span className="block text-sm font-extrabold text-[#1F2A25]">
                      استمر في البيع عند نفاد المخزون
                    </span>
                    <span className="mt-1 block text-xs text-[#8A938D]">
                      للطلبات المسبقة أو المنتجات المتوفرة قريبًا.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={continueSelling}
                    onChange={event => setContinueSelling(event.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                </label>
              </div>
            </FormCard>
          )}

          {productKind === "physical" && (
            <FormCard
              title="🔥 Smart Checkout Upsell"
              description="بعد ما يضغط العميل «اطلب الآن»، أظهر له منتج إضافي بسعر مخفض قبل تأكيد الطلب."
              icon={Sparkles}
            >
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E7E9E2] px-4 py-3 transition duration-200 hover:bg-[#FAF9F5]">
                  <span>
                    <span className="block text-sm font-extrabold text-[#1F2A25]">
                      تفعيل عرض الإضافة الذكية
                    </span>
                    <span className="mt-1 block text-xs text-[#8A938D]">
                      أضف منتج إضافي بسعر مخفض قبل تأكيد الطلب.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={upsellEnabled}
                    onChange={event => setUpsellEnabled(event.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                </label>

                {upsellEnabled && (
                  <div className="space-y-4">
                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      المنتج المرفق
                      <select
                        value={upsellProductId}
                        onChange={event => {
                          setUpsellProductId(
                            event.target.value ? Number(event.target.value) : ""
                          );
                          setUpsellLandingPageId("");
                        }}
                        className={inputClass}
                      >
                        <option value="" disabled>
                          اختر منتج من الكتالوج
                        </option>
                        {upsellCandidates.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.title} — {p.price ? `${p.price} دج` : "بدون سعر"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      ماذا يظهر للمشتري في النافذة؟
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            { value: "product", label: "صفحة المنتج" },
                            { value: "landing", label: "صفحة الهبوط (فانل)" },
                          ] as const
                        ).map(option => (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() => {
                              setUpsellViewType(option.value);
                              if (option.value === "product")
                                setUpsellLandingPageId("");
                            }}
                            className={`btn-press rounded-xl border p-2.5 text-center text-xs font-extrabold transition ${upsellViewType === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[#E3E1D8] bg-white text-[#5B6660] hover:border-[#B9CFC3]"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </label>

                    {upsellViewType === "landing" && (
                      <div>
                        {upsellLandingOptions.length > 0 ? (
                          <label className="block text-sm font-extrabold text-[#3D4A43]">
                            اختر صفحة الهبوط
                            <select
                              value={upsellLandingPageId}
                              onChange={event =>
                                setUpsellLandingPageId(
                                  event.target.value
                                    ? Number(event.target.value)
                                    : ""
                                )
                              }
                              className={inputClass}
                            >
                              <option value="" disabled>
                                اختر صفحة هبوط معتمدة
                              </option>
                              {upsellLandingOptions.map(lp => (
                                <option key={lp.id} value={lp.id}>
                                  {lp.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="rounded-xl bg-[var(--warm-soft)] px-3 py-2.5 text-xs leading-5 text-[#96601F]">
                            هذا المنتج لا يملك صفحة هبوط معتمدة بعد. أنشئ واحدة
                            من صفحة الفانل ثم اخترها هنا.
                          </p>
                        )}
                      </div>
                    )}

                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      نوع العرض
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {[
                          { value: "fixed_price", label: "سعر ثابت (+X دج)" },
                          {
                            value: "discount_amount",
                            label: "خصم مبلغ (وفر X دج)",
                          },
                          { value: "discount_percent", label: "خصم نسبة (%)" },
                        ].map(option => (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() =>
                              setUpsellDiscountMode(
                                option.value as
                                  | "fixed_price"
                                  | "discount_amount"
                                  | "discount_percent"
                              )
                            }
                            className={`btn-press rounded-xl border p-2.5 text-center text-xs font-extrabold transition ${upsellDiscountMode === option.value ? "border-[var(--warm)] bg-[var(--warm-soft)] text-[#B2611C]" : "border-[#E3E1D8] bg-white text-[#5B6660] hover:border-[#B9CFC3]"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </label>

                    {upsellDiscountMode === "fixed_price" && (
                      <label className="block text-sm font-extrabold text-[#3D4A43]">
                        السعر الإضافي
                        <div className="relative mt-2">
                          <input
                            className={`${inputClass} pl-12`}
                            inputMode="decimal"
                            value={upsellPrice}
                            onChange={event =>
                              setUpsellPrice(event.target.value)
                            }
                            placeholder="900.00"
                          />
                          <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                            دج
                          </span>
                        </div>
                      </label>
                    )}

                    {upsellDiscountMode === "discount_amount" && (
                      <label className="block text-sm font-extrabold text-[#3D4A43]">
                        مبلغ الخصم
                        <div className="relative mt-2">
                          <input
                            className={`${inputClass} pl-12`}
                            inputMode="decimal"
                            value={upsellDiscountAmount}
                            onChange={event =>
                              setUpsellDiscountAmount(event.target.value)
                            }
                            placeholder="400.00"
                          />
                          <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                            دج
                          </span>
                        </div>
                      </label>
                    )}

                    {upsellDiscountMode === "discount_percent" && (
                      <label className="block text-sm font-extrabold text-[#3D4A43]">
                        نسبة الخصم
                        <div className="relative mt-2">
                          <input
                            className={`${inputClass} pl-12`}
                            inputMode="numeric"
                            value={upsellDiscountPercent}
                            onChange={event =>
                              setUpsellDiscountPercent(event.target.value)
                            }
                            placeholder="20"
                          />
                          <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                            %
                          </span>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </FormCard>
          )}
        </div>

        <aside className="space-y-5 2xl:sticky 2xl:top-24 2xl:h-fit">
          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <PackageCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1F2A25]">
                  حالة المنتج
                </h2>
                <p className="mt-1 text-xs text-[#79837D]">
                  حدّد وضع المنتج عند الحفظ.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {(
                [
                  {
                    value: "draft",
                    label: "مسودة",
                    description: "غير ظاهر للعملاء",
                  },
                  {
                    value: "active",
                    label: "جاهز للنشر",
                    description: "سيُنشر عند تفعيل الكتالوج",
                  },
                ] as const
              ).map(option => (
                <button
                  key={option.value}
                  onClick={() => setStatus(option.value)}
                  className={`btn-press flex w-full items-center gap-3 rounded-xl border p-3 text-right transition duration-200 ${status === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[#E7E9E2] hover:bg-[#FAF9F5]"}`}
                >
                  <span
                    className={`grid size-4 place-items-center rounded-full border ${status === option.value ? "border-[var(--brand)]" : "border-[#C6CCC2]"}`}
                  >
                    {status === option.value && (
                      <span className="size-2 rounded-full bg-[var(--brand)]" />
                    )}
                  </span>
                  <span>
                    <span className="block text-xs font-extrabold text-[#1F2A25]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[11px] text-[#8A938D]">
                      {option.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-[24px] border border-[#DCE8E0] bg-[var(--brand-soft)] p-5">
            <div className="flex items-center gap-2">
              <Archive className="size-4 text-[var(--brand)]" />
              <p className="text-sm font-extrabold text-[#1F2A25]">ملخص سريع</p>
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-[#DCE8E0] pb-3">
                <dt className="text-[#5F7A6D]">الصور</dt>
                <dd className="font-extrabold text-[#1F2A25]">
                  {media.length}
                </dd>
              </div>
              <div className="flex justify-between border-b border-[#DCE8E0] pb-3">
                <dt className="text-[#5F7A6D]">المتغيرات</dt>
                <dd className="font-extrabold text-[#1F2A25]">
                  {hasVariants ? variants.length : 1}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5F7A6D]">تتبع المخزون</dt>
                <dd className="font-extrabold text-[#1F2A25]">
                  {trackInventory ? "مفعّل" : "غير مفعّل"}
                </dd>
              </div>
            </dl>
          </section>
          <Button
            disabled={createProduct.isPending}
            onClick={saveProduct}
            className="btn-press h-11 w-full rounded-xl bg-[var(--brand)] font-bold shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
          >
            <Save className="ml-2 size-4" />
            {createProduct.isPending ? "جارٍ الحفظ..." : "حفظ المنتج"}
          </Button>
          <button
            onClick={() =>
              toast.info(
                "ستتاح خاصية نسخ المنتجات بعد إضافة أول منتج إلى كتالوج عبدو ستور."
              )
            }
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-[#79837D] transition duration-200 hover:bg-white"
          >
            <Copy className="size-4" />
            نسخ من منتج موجود
          </button>
        </aside>
      </div>
    </div>
  );
}
