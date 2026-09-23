import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Banknote,
  FileArchive,
  Loader2,
  PackageSearch,
  Plus,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type OfferDraft = {
  id: string;
  description: string;
  quantity: string;
  price: string;
  maxUses: string;
  freeDelivery: boolean;
  enabled: boolean;
};
type CostBatchDraft = {
  id: string;
  quantity: string;
  productCostTotal: string;
  packagingCostTotal: string;
  procurementDeliveryCostTotal: string;
  receivedAt: string;
};

export default function ProductEdit() {
  const [, params] = useRoute("/products/:id/edit");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const id = Number(params?.id);
  const productQuery = trpc.products.get.useQuery(
    { id },
    { enabled: isAuthenticated && Number.isFinite(id) }
  );
  const updateProduct = trpc.products.update.useMutation({
    onSuccess: product => {
      toast.success(`تم تعديل «${product.title}».`);
      setLocation("/products");
    },
    onError: error => toast.error(error.message || "تعذر حفظ التعديل."),
  });
  const [form, setForm] = useState({
    title: "",
    categoryId: "" as string,
    description: "",
    price: "",
    compareAtPrice: "",
    costPerItem: "",
    costAccountingMode: "per_item" as "per_item" | "stock_total",
    costQuantity: "1",
    productCostTotal: "",
    packagingCostPerItem: "",
    packagingCostTotal: "",
    procurementDeliveryCostPerItem: "",
    procurementDeliveryCostTotal: "",
    returnCostPerOrder: "",
    returnDeliveryFree: false,
    sku: "",
    inventory: "0",
    lowStockThreshold: "5",
    showStockThreshold: "50",
    status: "draft" as "draft" | "active",
    trackInventory: true,
    continueSelling: false,
    productKind: "physical" as "physical" | "digital",
    currency: "DZD",
    digitalMaxDownloads: "5",
    digitalLinkValidityHours: "72",
    deliveryPricingMode: "manual" as "fixed" | "carrier" | "manual",
    deliveryCarrierConnectionId: undefined as number | undefined,
    upsellEnabled: false,
    upsellProductId: undefined as number | undefined,
    upsellPrice: "",
    upsellDiscountAmount: "",
    upsellDiscountPercent: "",
    upsellViewType: "product" as "product" | "landing",
    upsellLandingPageId: undefined as number | undefined,
    upsellDiscountMode: "fixed_price" as
      "fixed_price" | "discount_amount" | "discount_percent",
  });
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [costBatches, setCostBatches] = useState<CostBatchDraft[]>([]);
  /** Store categories for the (single) product category picker. */
  const categories = trpc.categories.list.useQuery(undefined, { retry: false });
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const createCategory = trpc.categories.create.useMutation();
  /** Create a category without leaving the form, then select it. */
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
          field("categoryId", String(data.id));
          setNewCategoryName("");
          setCreatingCategory(false);
          toast.success("تم إنشاء الفئة.");
        },
        onError: error => toast.error(error.message),
      }
    );
  };
  const storeProducts = trpc.products.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const upsellCandidates = (storeProducts.data ?? []).filter(
    (p): p is NonNullable<typeof p> => p != null && p.id !== id
  );
  const landingPagesQuery = trpc.landings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const upsellLandingOptions = (landingPagesQuery.data ?? []).filter(
    lp => lp.productId === form.upsellProductId
  );
  const carrierConnections = trpc.delivery?.carriers?.useQuery?.() ?? {
    data: [],
  };

  useEffect(() => {
    const product = productQuery.data;
    if (!product) return;
    setForm({
      title: product.title,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      description: product.description,
      price: product.price ?? "",
      compareAtPrice: product.compareAtPrice ?? "",
      costPerItem: product.costPerItem ?? "",
      costAccountingMode: product.costAccountingMode ?? "per_item",
      costQuantity: String(product.costQuantity ?? 1),
      productCostTotal: product.productCostTotal ?? "",
      packagingCostPerItem: product.packagingCostPerItem ?? "",
      packagingCostTotal: product.packagingCostTotal ?? "",
      procurementDeliveryCostPerItem:
        product.procurementDeliveryCostPerItem ?? "",
      procurementDeliveryCostTotal: product.procurementDeliveryCostTotal ?? "",
      returnCostPerOrder: product.returnCostPerOrder ?? "",
      returnDeliveryFree: product.returnDeliveryFree ?? false,
      sku: product.sku ?? "",
      inventory: String(product.inventory),
      lowStockThreshold: String(product.lowStockThreshold),
      showStockThreshold: String(product.showStockThreshold ?? 0),
      status: product.status,
      trackInventory: product.trackInventory,
      continueSelling: product.continueSelling,
      productKind: product.productKind,
      currency: product.currency,
      digitalMaxDownloads: String(product.digitalMaxDownloads ?? 5),
      digitalLinkValidityHours: String(product.digitalLinkValidityHours ?? 72),
      deliveryPricingMode: product.deliveryPricingMode,
      deliveryCarrierConnectionId:
        product.deliveryCarrierConnectionId ?? undefined,
      upsellEnabled: Boolean(product.upsellProductId),
      upsellProductId: product.upsellProductId ?? undefined,
      upsellPrice: product.upsellPrice ?? "",
      upsellDiscountAmount: product.upsellDiscountAmount ?? "",
      upsellDiscountPercent: product.upsellDiscountPercent?.toString() ?? "",
      upsellViewType: product.upsellViewType ?? "product",
      upsellLandingPageId: product.upsellLandingPageId ?? undefined,
      upsellDiscountMode: product.upsellPrice
        ? "fixed_price"
        : product.upsellDiscountAmount
          ? "discount_amount"
          : product.upsellDiscountPercent
            ? "discount_percent"
            : "fixed_price",
    });
    setOffers(
      (product.offers ?? []).map(offer => ({
        id: String(offer.id),
        description: offer.description,
        quantity: String(offer.quantity),
        price: offer.price,
        maxUses: String(offer.maxUses),
        freeDelivery: offer.freeDelivery,
        enabled: offer.enabled,
      }))
    );
    try {
      const batches = JSON.parse(product.costBatches ?? "[]");
      setCostBatches(
        Array.isArray(batches)
          ? batches.map((batch, index) => ({
              id: `batch-${index}-${Date.now()}`,
              quantity: String(batch.quantity ?? 1),
              productCostTotal: String(batch.productCostTotal ?? "0.00"),
              packagingCostTotal: String(batch.packagingCostTotal ?? "0.00"),
              procurementDeliveryCostTotal: String(
                batch.procurementDeliveryCostTotal ?? "0.00"
              ),
              receivedAt: String(batch.receivedAt ?? ""),
            }))
          : []
      );
    } catch {
      setCostBatches([]);
    }
  }, [productQuery.data]);

  if (productQuery.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
      </div>
    );
  if (!productQuery.data)
    return (
      <EmptyState
        icon={PackageSearch}
        title="تعذر العثور على المنتج."
        description="ربما حُذف المنتج أو تغيّر رابطه. عُد إلى قائمة المنتجات واختر منتجًا آخر للتعديل."
        action={
          <Button
            variant="outline"
            onClick={() => setLocation("/products")}
            className="btn-press rounded-xl border-[#E3E1D8]"
          >
            <ArrowRight className="ml-2 size-4" />
            العودة إلى المنتجات
          </Button>
        }
      />
    );
  const inputClass =
    "h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-medium text-[#1F2A25] outline-none transition placeholder:text-[#9AA39D] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";
  const field = (
    key: keyof typeof form,
    value: string | boolean | number | undefined
  ) => setForm(current => ({ ...current, [key]: value }));
  const addOffer = () =>
    setOffers(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "2",
        price: form.price,
        maxUses: "0",
        freeDelivery: false,
        enabled: true,
      },
    ]);
  const addCostBatch = () =>
    setCostBatches(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        quantity: "1",
        productCostTotal: "",
        packagingCostTotal: "",
        procurementDeliveryCostTotal: "",
        receivedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
  const save = () =>
    updateProduct.mutate({
      id,
      title: form.title,
      description: form.description,
      productType: productQuery.data.productType ?? "",
      collectionName: productQuery.data.collectionName ?? "",
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      productKind: form.productKind,
      currency: form.currency,
      status: form.status,
      price: form.price,
      compareAtPrice: form.compareAtPrice,
      costPerItem: form.costPerItem,
      costAccountingMode: form.costAccountingMode,
      costQuantity: Number(form.costQuantity || 1),
      productCostTotal: form.productCostTotal,
      packagingCostPerItem: form.packagingCostPerItem,
      packagingCostTotal: form.packagingCostTotal,
      procurementDeliveryCostPerItem: form.procurementDeliveryCostPerItem,
      procurementDeliveryCostTotal: form.procurementDeliveryCostTotal,
      returnCostPerOrder: form.returnCostPerOrder,
      returnDeliveryFree: form.returnDeliveryFree,
      costBatches: costBatches.map(batch => ({
        quantity: Number(batch.quantity || 1),
        productCostTotal: batch.productCostTotal || "0.00",
        packagingCostTotal: batch.packagingCostTotal || "0.00",
        procurementDeliveryCostTotal:
          batch.procurementDeliveryCostTotal || "0.00",
        receivedAt: batch.receivedAt || undefined,
      })),
      sku: form.sku,
      inventory: Number(form.inventory || 0),
      lowStockThreshold: Number(form.lowStockThreshold || 0),
      showStockThreshold: Number(form.showStockThreshold || 0),
      trackInventory: form.trackInventory,
      continueSelling: form.continueSelling,
      deliveryPricingMode:
        form.productKind === "digital" ? "fixed" : form.deliveryPricingMode,
      deliveryCarrierConnectionId:
        form.deliveryPricingMode === "carrier"
          ? form.deliveryCarrierConnectionId
          : undefined,
      offers:
        form.productKind === "digital"
          ? []
          : offers.map(offer => ({
              description: offer.description,
              quantity: Number(offer.quantity || 1),
              price: offer.price,
              maxUses: Number(offer.maxUses || 0),
              freeDelivery: offer.freeDelivery,
              enabled: offer.enabled,
            })),
      digitalMaxDownloads:
        form.productKind === "digital"
          ? Number(form.digitalMaxDownloads || 5)
          : undefined,
      digitalLinkValidityHours:
        form.productKind === "digital"
          ? Number(form.digitalLinkValidityHours || 72)
          : undefined,
      upsellProductId:
        form.productKind === "digital"
          ? null
          : form.upsellEnabled && form.upsellProductId
            ? Number(form.upsellProductId)
            : null,
      upsellViewType:
        form.upsellEnabled && form.upsellProductId
          ? (form.upsellViewType ?? "product")
          : "product",
      upsellLandingPageId:
        form.upsellEnabled &&
        form.upsellProductId &&
        form.upsellViewType === "landing" &&
        form.upsellLandingPageId
          ? Number(form.upsellLandingPageId)
          : null,
      upsellPrice:
        form.upsellEnabled &&
        form.upsellDiscountMode === "fixed_price" &&
        form.upsellPrice
          ? form.upsellPrice
          : "",
      upsellDiscountAmount:
        form.upsellEnabled &&
        form.upsellDiscountMode === "discount_amount" &&
        form.upsellDiscountAmount
          ? form.upsellDiscountAmount
          : "",
      upsellDiscountPercent:
        form.upsellEnabled &&
        form.upsellDiscountMode === "discount_percent" &&
        form.upsellDiscountPercent
          ? Number(form.upsellDiscountPercent)
          : null,
    });

  return (
    <div className="max-w-5xl">
      <PageIntro
        eyebrow="الكتالوج · تعديل"
        title={`تعديل ${productQuery.data.title}`}
        description="عدّل معلومات المنتج الأساسية وسعره ومخزونه وعروضه أو إعدادات تسليمه الرقمي."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/products")}
              className="btn-press rounded-xl border-[#E3E1D8]"
            >
              <ArrowRight className="ml-2 size-4" />
              رجوع
            </Button>
            <Button
              disabled={updateProduct.isPending}
              onClick={save}
              className="btn-press rounded-xl bg-[var(--brand)] shadow-cta hover:bg-[var(--brand-strong)]"
            >
              <Save className="ml-2 size-4" />
              حفظ التعديلات
            </Button>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-5 rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
              عنوان المنتج
              <input
                className={inputClass}
                value={form.title}
                onChange={event => field("title", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
              الوصف
              <textarea
                className="min-h-36 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm text-[#1F2A25] outline-none transition placeholder:text-[#9AA39D] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                value={form.description}
                onChange={event => field("description", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
              الفئة الأساسية
              {creatingCategory ? (
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
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
                  className={inputClass}
                  value={form.categoryId}
                  onChange={event => {
                    if (event.target.value === "__new__") {
                      setCreatingCategory(true);
                      return;
                    }
                    field("categoryId", event.target.value);
                  }}
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
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                السعر
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form.price}
                  onChange={event => field("price", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                قبل التخفيض
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form.compareAtPrice}
                  onChange={event =>
                    field("compareAtPrice", event.target.value)
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                تكلفة القطعة
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form.costPerItem}
                  onChange={event => field("costPerItem", event.target.value)}
                />
              </label>
            </div>
            {form.productKind === "physical" && (
              <div className="mt-5 rounded-2xl border border-[#DCE7DF] bg-[var(--brand-soft)] p-4">
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  Costs & Profitability{" "}
                  <span className="text-[10px] font-medium text-[#6E7B73]">
                    خاص بالمالك
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-[#5A6660]">
                  هذه التكاليف لا تظهر للزبون وتُحفظ كأساس لمحرك الربحية.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => field("costAccountingMode", "per_item")}
                    className={`btn-press rounded-xl border p-3 text-right text-xs font-bold transition ${form.costAccountingMode === "per_item" ? "border-[var(--brand)] bg-white text-[var(--brand)] shadow-soft" : "border-[#DDE3DA] bg-white/60 text-[#79837D] hover:border-[#C9CFC2]"}`}
                  >
                    تكلفة لكل قطعة
                  </button>
                  <button
                    type="button"
                    onClick={() => field("costAccountingMode", "stock_total")}
                    className={`btn-press rounded-xl border p-3 text-right text-xs font-bold transition ${form.costAccountingMode === "stock_total" ? "border-[var(--brand)] bg-white text-[var(--brand)] shadow-soft" : "border-[#DDE3DA] bg-white/60 text-[#79837D] hover:border-[#C9CFC2]"}`}
                  >
                    تكلفة إجمالية للمخزون
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-2 text-xs font-bold text-[#5A6660]">
                    {form.costAccountingMode === "per_item"
                      ? "تكلفة الشراء/قطعة"
                      : "إجمالي الشراء"}
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={
                        form.costAccountingMode === "per_item"
                          ? form.costPerItem
                          : form.productCostTotal
                      }
                      onChange={event =>
                        field(
                          form.costAccountingMode === "per_item"
                            ? "costPerItem"
                            : "productCostTotal",
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-bold text-[#5A6660]">
                    عدد القطع
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.costQuantity}
                      onChange={event =>
                        field("costQuantity", event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-bold text-[#5A6660]">
                    روتور لكل طلب
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={form.returnCostPerOrder}
                      onChange={event =>
                        field("returnCostPerOrder", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-bold text-[#5A6660]">
                    التغليف/قطعة
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={form.packagingCostPerItem}
                      onChange={event =>
                        field("packagingCostPerItem", event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-bold text-[#5A6660]">
                    توصيل التوريد/قطعة
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={form.procurementDeliveryCostPerItem}
                      onChange={event =>
                        field(
                          "procurementDeliveryCostPerItem",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#5A6660]">
                  <input
                    type="checkbox"
                    checked={form.returnDeliveryFree}
                    onChange={event =>
                      field("returnDeliveryFree", event.target.checked)
                    }
                    className="accent-[var(--brand)]"
                  />
                  الروتور مجاني
                </label>
                <div className="mt-4 rounded-xl border border-[#E3E1D8] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold text-[#1F2A25]">
                        دفعات شراء إضافية
                      </p>
                      <p className="mt-1 text-[11px] text-[#79837D]">
                        سجّل كل عملية تزويد بتكلفتها المستقلة.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCostBatch}
                      className="btn-press h-9 rounded-lg px-3 text-xs font-bold"
                    >
                      <Plus className="ml-1 size-3.5" />
                      دفعة
                    </Button>
                  </div>
                  {costBatches.map((batch, index) => (
                    <div
                      key={batch.id}
                      className="mt-3 rounded-xl border border-[#ECEEE6] bg-[#FAFAF7] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-[var(--brand)]">
                          دفعة {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCostBatches(current =>
                              current.filter(item => item.id !== batch.id)
                            )
                          }
                          className="btn-press text-[11px] font-bold text-[#A63D28] transition hover:text-[#8C3221]"
                        >
                          حذف
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <input
                          className={inputClass}
                          aria-label={`كمية دفعة ${index + 1}`}
                          inputMode="numeric"
                          value={batch.quantity}
                          onChange={event =>
                            setCostBatches(current =>
                              current.map(item =>
                                item.id === batch.id
                                  ? { ...item, quantity: event.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="القطع"
                        />
                        <input
                          className={inputClass}
                          aria-label={`إجمالي شراء دفعة ${index + 1}`}
                          inputMode="decimal"
                          value={batch.productCostTotal}
                          onChange={event =>
                            setCostBatches(current =>
                              current.map(item =>
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
                        />
                        <input
                          className={inputClass}
                          aria-label={`إجمالي تغليف دفعة ${index + 1}`}
                          inputMode="decimal"
                          value={batch.packagingCostTotal}
                          onChange={event =>
                            setCostBatches(current =>
                              current.map(item =>
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
                        />
                        <input
                          className={inputClass}
                          aria-label={`إجمالي توريد دفعة ${index + 1}`}
                          inputMode="decimal"
                          value={batch.procurementDeliveryCostTotal}
                          onChange={event =>
                            setCostBatches(current =>
                              current.map(item =>
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
                        />
                      </div>
                      <input
                        className={`${inputClass} mt-2`}
                        aria-label={`تاريخ دفعة ${index + 1}`}
                        type="date"
                        value={batch.receivedAt}
                        onChange={event =>
                          setCostBatches(current =>
                            current.map(item =>
                              item.id === batch.id
                                ? { ...item, receivedAt: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[#79837D]">
                  هذه البيانات داخلية للمالك فقط، ولا تظهر في صفحة المنتج أو
                  نموذج الطلب.
                </p>
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                SKU
                <input
                  className={inputClass}
                  value={form.sku}
                  onChange={event => field("sku", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                المخزون
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.inventory}
                  onChange={event => field("inventory", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                حد التنبيه
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.lowStockThreshold}
                  onChange={event =>
                    field("lowStockThreshold", event.target.value)
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-[#3D4A43]">
                إظهار المخزون للعملاء عند
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.showStockThreshold}
                  onChange={event =>
                    field("showStockThreshold", event.target.value)
                  }
                />
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4">
            <p className="text-sm font-extrabold text-[#1F2A25]">نوع التسليم</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => field("productKind", "physical")}
                className={`btn-press rounded-xl border p-3 text-right text-xs font-extrabold transition ${form.productKind === "physical" ? "border-[var(--brand)] bg-white text-[var(--brand)] shadow-soft" : "border-transparent text-[#79837D] hover:bg-white"}`}
              >
                منتج مادي
                <p className="mt-1 text-[10px] font-medium">
                  يتطلب التوصيل ومعلومات الاستلام
                </p>
              </button>
              <button
                type="button"
                onClick={() => field("productKind", "digital")}
                className={`btn-press rounded-xl border p-3 text-right text-xs font-extrabold transition ${form.productKind === "digital" ? "border-[var(--brand)] bg-white text-[var(--brand)] shadow-soft" : "border-transparent text-[#79837D] hover:bg-white"}`}
              >
                منتج رقمي
                <p className="mt-1 text-[10px] font-medium">
                  الرابط ينشأ بعد تأكيد الدفع
                </p>
              </button>
            </div>
          </div>
          {form.productKind === "digital" && (
            <div className="rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4">
              <div className="flex items-center gap-2">
                <FileArchive className="size-4 text-[var(--brand)]" />
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  إعدادات الملف الرقمي
                </p>
              </div>
              <p className="mt-2 text-xs leading-6 text-[#79837D]">
                الملف الحالي: {productQuery.data.digitalFileName ?? "غير محدد"}.
                تغيير الملف يتم من خلال إنشاء نسخة جديدة من المنتج حفاظًا على
                الروابط السابقة.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2 text-xs font-extrabold text-[#3D4A43]">
                  العملة
                  <select
                    className={inputClass}
                    value={form.currency}
                    onChange={event => field("currency", event.target.value)}
                  >
                    <option value="DZD">DZD · دج</option>
                    <option value="EUR">EUR · €</option>
                    <option value="USD">USD · $</option>
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-extrabold text-[#3D4A43]">
                  مرات التحميل (اختياري)
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.digitalMaxDownloads}
                    onChange={event =>
                      field("digitalMaxDownloads", event.target.value)
                    }
                  />
                </label>
                <label className="grid gap-2 text-xs font-extrabold text-[#3D4A43]">
                  صلاحية الرابط بالساعات (اختياري)
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.digitalLinkValidityHours}
                    onChange={event =>
                      field("digitalLinkValidityHours", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          )}
          {form.productKind === "physical" && (
            <div className="rounded-2xl border border-[#E7E9E2] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-[#1F2A25]">
                    العروض
                  </p>
                  <p className="mt-1 text-xs text-[#79837D]">
                    تعديل عروض الكمية والتوصيل المجاني.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addOffer}
                  className="btn-press rounded-xl border-[#E3E1D8] font-extrabold"
                >
                  <Plus className="ml-2 size-4" />
                  إضافة عرض
                </Button>
              </div>
              {offers.map((offer, index) => (
                <div
                  key={offer.id}
                  className="mt-3 rounded-xl border border-[#ECEEE6] bg-[#FAFAF7] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[var(--brand)]">
                      العرض {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOffers(current =>
                          current.filter(item => item.id !== offer.id)
                        )
                      }
                      className="btn-press text-[#A63D28] transition hover:text-[#8C3221]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <input
                      className={inputClass}
                      aria-label={`وصف العرض ${index + 1}`}
                      value={offer.description}
                      onChange={event =>
                        setOffers(current =>
                          current.map(item =>
                            item.id === offer.id
                              ? { ...item, description: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="الوصف"
                    />
                    <input
                      className={inputClass}
                      aria-label={`كمية العرض ${index + 1}`}
                      value={offer.quantity}
                      onChange={event =>
                        setOffers(current =>
                          current.map(item =>
                            item.id === offer.id
                              ? { ...item, quantity: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="الكمية"
                    />
                    <input
                      className={inputClass}
                      aria-label={`سعر العرض ${index + 1}`}
                      value={offer.price}
                      onChange={event =>
                        setOffers(current =>
                          current.map(item =>
                            item.id === offer.id
                              ? { ...item, price: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="السعر"
                    />
                    <input
                      className={inputClass}
                      aria-label={`عدد العروض ${index + 1}`}
                      value={offer.maxUses}
                      onChange={event =>
                        setOffers(current =>
                          current.map(item =>
                            item.id === offer.id
                              ? { ...item, maxUses: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="عدد العروض"
                    />
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#5A6660]">
                    <input
                      type="checkbox"
                      checked={offer.freeDelivery}
                      onChange={event =>
                        setOffers(current =>
                          current.map(item =>
                            item.id === offer.id
                              ? { ...item, freeDelivery: event.target.checked }
                              : item
                          )
                        )
                      }
                      className="accent-[var(--brand)]"
                    />
                    توصيل مجاني
                  </label>
                </div>
              ))}
            </div>
          )}
          {form.productKind === "physical" && (
            <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--warm-soft)] text-[var(--warm)]">
                  <Banknote className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#1F2A25]">
                    🔥 Smart Checkout Upsell
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#79837D]">
                    بعد ما يضغط العميل «اطلب الآن»، أظهر له منتج إضافي بسعر مخفض
                    قبل تأكيد الطلب.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[#DCE7DF] bg-[var(--brand-soft)] p-4">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E7E9E2] px-4 py-3 transition duration-200 hover:bg-[#FAF9F7]">
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
                    checked={form.upsellEnabled}
                    onChange={e => field("upsellEnabled", e.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                </label>
              </div>
              {form.upsellEnabled && (
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-extrabold text-[#3D4A43]">
                    منتج الإضافة
                    <select
                      value={form.upsellProductId ?? ""}
                      onChange={e => {
                        field(
                          "upsellProductId",
                          e.target.value ? Number(e.target.value) : undefined
                        );
                        field("upsellLandingPageId", undefined);
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
                            field("upsellViewType", option.value);
                            if (option.value === "product")
                              field("upsellLandingPageId", undefined);
                          }}
                          className={`btn-press rounded-xl border p-2.5 text-center text-xs font-extrabold transition ${form.upsellViewType === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[#E3E1D8] bg-white text-[#5B6660] hover:border-[#B9CFC3]"}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  {form.upsellViewType === "landing" && (
                    <div>
                      {upsellLandingOptions.length > 0 ? (
                        <label className="block text-sm font-extrabold text-[#3D4A43]">
                          اختر صفحة الهبوط
                          <select
                            value={form.upsellLandingPageId ?? ""}
                            onChange={e =>
                              field(
                                "upsellLandingPageId",
                                e.target.value
                                  ? Number(e.target.value)
                                  : undefined
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
                          هذا المنتج لا يملك صفحة هبوط معتمدة بعد. أنشئ واحدة من
                          صفحة الفانل ثم اخترها هنا.
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
                            field(
                              "upsellDiscountMode",
                              option.value as
                                | "fixed_price"
                                | "discount_amount"
                                | "discount_percent"
                            )
                          }
                          className={`btn-press rounded-xl border p-2.5 text-center text-xs font-extrabold transition ${form.upsellDiscountMode === option.value ? "border-[var(--warm)] bg-[var(--warm-soft)] text-[#B2611C]" : "border-[#E3E1D8] bg-white text-[#5B6660] hover:border-[#B9CFC3]"}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </label>
                  {form.upsellDiscountMode === "fixed_price" && (
                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      السعر الإضافي
                      <div className="relative mt-2">
                        <input
                          className={`${inputClass} pl-12`}
                          inputMode="decimal"
                          value={form.upsellPrice}
                          onChange={e => field("upsellPrice", e.target.value)}
                          placeholder="900.00"
                        />
                        <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                          دج
                        </span>
                      </div>
                    </label>
                  )}
                  {form.upsellDiscountMode === "discount_amount" && (
                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      مبلغ الخصم
                      <div className="relative mt-2">
                        <input
                          className={`${inputClass} pl-12`}
                          inputMode="decimal"
                          value={form.upsellDiscountAmount}
                          onChange={e =>
                            field("upsellDiscountAmount", e.target.value)
                          }
                          placeholder="400.00"
                        />
                        <span className="absolute left-3 top-3 text-xs font-extrabold text-[#8A938D]">
                          دج
                        </span>
                      </div>
                    </label>
                  )}
                  {form.upsellDiscountMode === "discount_percent" && (
                    <label className="block text-sm font-extrabold text-[#3D4A43]">
                      نسبة الخصم
                      <div className="relative mt-2">
                        <input
                          className={`${inputClass} pl-12`}
                          inputMode="numeric"
                          value={form.upsellDiscountPercent}
                          onChange={e =>
                            field("upsellDiscountPercent", e.target.value)
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
            </section>
          )}
        </section>
        <aside className="space-y-4">
          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-[var(--brand)]" />
              <p className="text-sm font-extrabold text-[#1F2A25]">
                مصدر سعر التوصيل
              </p>
            </div>
            {form.productKind === "digital" ? (
              <p className="mt-3 rounded-xl bg-[var(--brand-soft)] p-3 text-xs leading-6 text-[#5A6660]">
                لا ينطبق التوصيل على المنتج الرقمي.
              </p>
            ) : (
              <>
                <div className="mt-3 grid gap-2">
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
                      onClick={() => field("deliveryPricingMode", option.value)}
                      className={`btn-press rounded-xl border p-2.5 text-right text-xs font-extrabold transition ${form.deliveryPricingMode === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[#E3E1D8] text-[#79837D] hover:border-[#C9CFC2] hover:text-[#3D4A43]"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {form.deliveryPricingMode === "carrier" && (
                  <select
                    aria-label="شركة التوصيل للمنتج"
                    value={form.deliveryCarrierConnectionId ?? ""}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        deliveryCarrierConnectionId: Number(event.target.value),
                      }))
                    }
                    className="mt-3 h-10 w-full rounded-xl border border-[#E3E1D8] bg-white px-2 text-xs font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                  >
                    <option value="" disabled>
                      {carrierConnections.data?.length
                        ? "اختر الشركة المرتبطة"
                        : "لا توجد شركة مرتبطة"}
                    </option>
                    {carrierConnections.data
                      ?.filter(item => item.status === "connected")
                      .map(item => (
                        <option key={item.id} value={item.id}>
                          {item.accountName}
                        </option>
                      ))}
                  </select>
                )}
              </>
            )}
          </section>
          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <p className="text-sm font-extrabold text-[#1F2A25]">حالة المنتج</p>
            <div className="mt-4 space-y-2">
              {(["draft", "active"] as const).map(status => (
                <button
                  key={status}
                  onClick={() => field("status", status)}
                  className={`btn-press w-full rounded-xl border p-3 text-right text-sm font-bold transition ${form.status === status ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[#E3E1D8] text-[#79837D] hover:border-[#C9CFC2] hover:text-[#3D4A43]"}`}
                >
                  {status === "active" ? "منشور في واجهة المتجر" : "مسودة"}
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <p className="text-sm font-extrabold text-[#1F2A25]">
              الصور والمتغيرات
            </p>
            <p className="mt-2 text-xs leading-6 text-[#79837D]">
              الصور والمتغيرات الحالية محفوظة كما هي:{" "}
              {productQuery.data.images.length} صور و
              {productQuery.data.variants.length} متغيرات.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
