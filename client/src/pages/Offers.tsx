import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type Tier = {
  quantity: string;
  price: string;
  description: string;
  maxUses: string;
  freeDelivery: boolean;
};

type Draft = {
  id?: number;
  /** "bundle" = several products + discount, "quantity" = legacy tiers. */
  kind: "bundle" | "quantity";
  name: string;
  slug: string;
  imageUrl: string;
  discountType: "" | "percent" | "amount";
  discountValue: string;
  /** Quantity deals: the product whose tiers are being created. */
  productId: string;
  /** Quantity deals: one row per tier (1 piece at X, 2 at Y, ...). */
  tiers: Tier[];
  /** Single-tier edit mode (kind='quantity' + id set). */
  quantity: string;
  fixedPrice: string;
  maxUses: string;
  freeDelivery: boolean;
  isActive: boolean;
};

const emptyTier = (): Tier => ({
  quantity: "",
  price: "",
  description: "",
  maxUses: "0",
  freeDelivery: false,
});

const emptyDraft: Draft = {
  kind: "bundle",
  name: "",
  slug: "",
  imageUrl: "",
  discountType: "",
  discountValue: "",
  productId: "",
  tiers: [emptyTier()],
  quantity: "2",
  fixedPrice: "",
  maxUses: "0",
  freeDelivery: false,
  isActive: true,
};

type UpsellDraft = {
  productId: string;
  upsellProductId: string;
  upsellPrice: string;
  discountMode: "" | "amount" | "percent";
  discountValue: string;
  viewType: "product" | "landing";
  landingPageId: string;
};

const emptyUpsellDraft = (): UpsellDraft => ({
  productId: "",
  upsellProductId: "",
  upsellPrice: "",
  discountMode: "",
  discountValue: "",
  viewType: "product",
  landingPageId: "",
});

const slugPreview = (value: string) =>
  value
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const money = (value: number) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(value)} دج`;

export default function Offers() {
  const utils = trpc.useUtils();
  /** Each offer kind has its own list; Upsell edits the product's columns. */
  const [tab, setTab] = useState<"bundle" | "quantity" | "upsell">("bundle");
  const [upsellDraft, setUpsellDraft] = useState<UpsellDraft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [managing, setManaging] = useState<{ id: number; name: string } | null>(
    null
  );
  /** productId → selected quantity */
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [filter, setFilter] = useState("");

  const offers = trpc.offers.list.useQuery();
  const products = trpc.products.list.useQuery(undefined, {
    // Needed for ⚙, the create/edit picker and the whole Upsell tab.
    enabled: Boolean(managing || draft || upsellDraft || tab === "upsell"),
  });

  const invalidate = () => void utils.offers.list.invalidate();

  const create = trpc.offers.create.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة العرض.");
      setDraft(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.offers.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث العرض.");
      setDraft(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.offers.remove.useMutation({
    onSuccess: () => {
      toast.success("تم حذف العرض.");
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setProducts = trpc.offers.setProducts.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث منتجات العرض.");
      setManaging(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reorder = trpc.offers.reorder.useMutation({
    onSuccess: () => invalidate(),
    onError: error => toast.error(error.message),
  });
  const [ordered, setOrdered] = useState<number[] | null>(null);
  const rows = ordered
    ? [...(offers.data ?? [])].sort(
        (a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id)
      )
    : offers.data ?? [];
  /** Each tab has its own list (never one merged list). */
  const tabRows =
    tab === "bundle"
      ? rows.filter(row => row.kind !== "quantity")
      : tab === "quantity"
        ? rows.filter(row => row.kind === "quantity")
        : [];

  /**
   * Quantity deals are grouped per product: creating 10 tiers for one product
   * shows ONE row for it, and opening it reveals all its tiers.
   */
  const quantityGroups = useMemo(() => {
    const map = new Map<
      number,
      { productId: number; title: string; rows: typeof tabRows }
    >();
    for (const row of tabRows) {
      const productId = row.items[0]?.productId ?? 0;
      if (!map.has(productId)) {
        map.set(productId, {
          productId,
          title: row.items[0]?.title ?? "منتج",
          rows: [],
        });
      }
      map.get(productId)!.rows.push(row);
    }
    return Array.from(map.values());
  }, [tabRows]);

  const uploadAsset = trpc.storefront.uploadAsset.useMutation();
  const setUpsell = trpc.offers.setUpsell.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ العرض التكميلي (Upsell).");
      setUpsellDraft(null);
      void utils.products.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  /** Products whose upsell columns are configured (the bridge list). */
  const upsellRows = (products.data ?? []).filter(
    (product): product is NonNullable<typeof product> =>
      product != null && product.upsellProductId != null
  );

  const saveUpsell = () => {
    if (!upsellDraft) return;
    if (!upsellDraft.productId || !upsellDraft.upsellProductId) {
      toast.error("اختر المنتج الأساسي ومنتج العرض التكميلي.");
      return;
    }
    const num = (value: string) =>
      value.trim() ? Number(value.replace(",", ".")) : 0;
    setUpsell.mutate({
      productId: Number(upsellDraft.productId),
      upsellProductId: Number(upsellDraft.upsellProductId),
      upsellPrice: upsellDraft.upsellPrice.trim()
        ? num(upsellDraft.upsellPrice)
        : null,
      upsellDiscountAmount:
        upsellDraft.discountMode === "amount" ? num(upsellDraft.discountValue) : null,
      upsellDiscountPercent:
        upsellDraft.discountMode === "percent"
          ? Math.round(num(upsellDraft.discountValue))
          : null,
      upsellViewType: upsellDraft.viewType,
      upsellLandingPageId:
        upsellDraft.viewType === "landing" && upsellDraft.landingPageId
          ? Number(upsellDraft.landingPageId)
          : null,
    });
  };

  const toggleActive = (id: number, isActive: boolean) =>
    update.mutate({ id, isActive });

  const openProducts = (row: {
    id: number;
    name: string;
    items: Array<{ productId: number; quantity: number }>;
  }) => {
    const next: Record<number, number> = {};
    for (const item of row.items) next[item.productId] = item.quantity;
    setPicked(next);
    setFilter("");
    setManaging({ id: row.id, name: row.name });
  };

  const visibleProducts = useMemo(() => {
    const query = filter.trim().toLowerCase();
    // Digital products are excluded: they use a different checkout flow and can
    // never be part of a bundle (enforced again on the server).
    const list = (products.data ?? []).filter(
      (product): product is NonNullable<typeof product> =>
        product != null && product.productKind !== "digital"
    );
    if (!query) return list;
    return list.filter(product =>
      (product.title ?? "").toLowerCase().includes(query)
    );
  }, [products.data, filter]);

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    // Bundles need a name; quantity tiers carry their own per-tier description.
    if (draft.kind === "bundle" && !name) {
      toast.error("اسم العرض مطلوب.");
      return;
    }
    const num = (value: string) =>
      value.trim() ? Number(value.replace(",", ".")) : 0;

    /**
     * Quantity deal (legacy): ONE product with one or several tiers
     * ("1 piece at X, 2 at Y, ..."), created together. Editing touches the
     * selected tier only.
     */
    if (draft.kind === "quantity") {
      const productId = draft.productId ? Number(draft.productId) : 0;
      if (!productId) {
        toast.error("اختر المنتج.");
        return;
      }
      const parsed = draft.tiers.map(tier => ({
        quantity: Math.max(1, Math.trunc(num(tier.quantity) || 1)),
        price: num(tier.price),
        description: tier.description.trim(),
        // Per-tier usage limit (0 = unlimited).
        maxUses: Math.max(0, Math.trunc(num(tier.maxUses) || 0)),
        freeDelivery: tier.freeDelivery,
      }));
      if (parsed.some(tier => tier.price <= 0)) {
        toast.error("أدخل سعرًا أكبر من صفر لكل طبقة.");
        return;
      }
      if (draft.id) {
        // Editing an existing tier: a single-row update.
        const tier = parsed[0];
        update.mutate({
          id: draft.id,
          kind: "quantity",
          name: (tier.description || name).trim(),
          productId,
          quantity: tier.quantity,
          fixedPrice: tier.price,
          maxUses: tier.maxUses,
          freeDelivery: tier.freeDelivery,
          isActive: draft.isActive,
        });
        return;
      }
      create.mutate({
        kind: "quantity",
        name: name || parsed[0]?.description || "عرض خصم كمية",
        productId,
        tiers: parsed.map(tier => ({
          ...tier,
          description: tier.description || name || "عرض خصم كمية",
        })),
        isActive: draft.isActive,
      });
      return;
    }

    const value = num(draft.discountValue);
    if (draft.discountType && value <= 0) {
      toast.error("أدخل قيمة خصم أكبر من صفر.");
      return;
    }
    // A bundle without at least two products is meaningless.
    if (!draft.id && pickedItems.length < 2) {
      toast.error("اختر منتجين على الأقل للباقة.");
      return;
    }
    const payload = {
      kind: "bundle" as const,
      name,
      slug: draft.slug.trim() || slugPreview(name),
      imageUrl: draft.imageUrl.trim(),
      discountType: draft.discountType || null,
      discountValue: draft.discountType ? value : null,
      freeDelivery: draft.freeDelivery,
      isActive: draft.isActive,
      // Products are chosen INSIDE the create form; edits after creation go
      // through ⚙ (setProducts).
      ...(draft.id ? {} : { items: pickedItems }),
    };
    if (draft.id) update.mutate({ id: draft.id, ...payload });
    else create.mutate(payload);
  };

  const move = (id: number, direction: -1 | 1) => {
    const ids = rows.map(row => row.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setOrdered(ids);
    reorder.mutate({ ids });
  };

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const out = await uploadAsset.mutateAsync({ fileName: file.name, dataUrl });
      setDraft(current => (current ? { ...current, imageUrl: out.url } : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر رفع الصورة.");
    } finally {
      setUploading(false);
    }
  };

  const pickedItems = Object.entries(picked)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId: Number(productId), quantity }));

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-[#181a2b]">
            <BadgePercent className="size-5 text-[var(--brand)]" /> العروض
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#73758a]">
            عرض = مجموعة منتجات موجودة (كل واحد بكمية) + خصم اختياري + توصيل
            مجاني اختياري. السعر يُحسب تلقائيًا من أسعار المنتجات ناقص الخصم،
            ويظهر في المتجر فقط العرض الصالح الذي فيه منتجون منشورون ومتوفرون.
          </p>
        </div>
      </div>

      {/* One tab per offer kind: each kind has its own list. */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E7E9E2] bg-white p-1.5">
        {(
          [
            { id: "bundle", label: "باقات" },
            { id: "quantity", label: "خصم كمية" },
            { id: "upsell", label: "Upsell" },
          ] as const
        ).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition ${
              tab === item.id
                ? "bg-[var(--brand-soft)] text-[#0B5D57]"
                : "text-[#73758a] hover:bg-[#F7F7F3]"
            }`}
          >
            {item.label}
            {item.id !== "upsell" ? (
              <span className="mr-1.5 text-[11px] font-bold text-[#9aa39d]">
                {item.id === "bundle"
                  ? rows.filter(row => row.kind !== "quantity").length
                  : rows.filter(row => row.kind === "quantity").length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Contextual add action, inside the active tab. */}
      <div className="flex items-center justify-between rounded-2xl border border-[#E7E9E2] bg-white px-4 py-3">
        <span className="text-[12.5px] font-black text-[#576B66]">
          {tab === "bundle"
            ? "الباقات"
            : tab === "quantity"
              ? "عروض خصم الكمية"
              : "Smart Checkout Upsell"}
        </span>
        <Button
          onClick={() => {
            if (tab === "bundle") setDraft({ ...emptyDraft, kind: "bundle" });
            else if (tab === "quantity")
              setDraft({ ...emptyDraft, kind: "quantity", tiers: [emptyTier()] });
            else setUpsellDraft(emptyUpsellDraft());
          }}
          className="h-10 rounded-xl brand-shine cta-gradient px-4 text-[12.5px] font-extrabold"
        >
          <Plus className="ml-1.5 size-4" />
          {tab === "bundle"
            ? "إضافة باقة"
            : tab === "quantity"
              ? "إضافة خصم كمية"
              : "إضافة Upsell"}
        </Button>
      </div>


      {tab === "upsell" ? (
        upsellRows.length === 0 ? (
          <Card className="rounded-2xl border-[#E7E9E2]">
            <CardContent className="space-y-3 py-14 text-center text-sm text-[#73758a]">
              <p>
                لا عروض تكميلية (Upsell) بعد. الـUpsell هو اقتراح منتج ثانٍ داخل
                صفحة الطلب بسعر خاص.
              </p>
              <Button
                onClick={() =>
                  setUpsellDraft(emptyUpsellDraft())
                }
                className="rounded-xl brand-shine cta-gradient font-extrabold"
              >
                إضافة Upsell
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-[#E7E9E2]">
            <CardContent className="p-0">
              <ul className="divide-y divide-[#F1F3F2]">
                {upsellRows.map(product => {
                  const target = (products.data ?? []).find(
                    candidate => candidate?.id === product.upsellProductId
                  );
                  return (
                    <li
                      key={product.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-extrabold text-[#181a2b]">
                            {product.title}
                          </span>
                          <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-bold text-[#3730A3]">
                            Upsell
                          </span>
                        </div>
                        <p className="text-[12px] text-[#9aa39d]">
                          يقترح: {target?.title ?? `#${product.upsellProductId}`}
                          {product.upsellPrice
                            ? ` · بسعر ${money(Number(product.upsellPrice))}`
                            : ""}
                          {product.upsellViewType === "landing"
                            ? " · داخل اللاندينغ"
                            : " · داخل صفحة المنتج"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setUpsellDraft({
                            productId: String(product.id),
                            upsellProductId: product.upsellProductId
                              ? String(product.upsellProductId)
                              : "",
                            upsellPrice: product.upsellPrice ?? "",
                            discountMode: product.upsellDiscountPercent
                              ? "percent"
                              : product.upsellDiscountAmount
                                ? "amount"
                                : "",
                            discountValue:
                              product.upsellDiscountPercent != null
                                ? String(product.upsellDiscountPercent)
                                : (product.upsellDiscountAmount ?? ""),
                            viewType:
                              product.upsellViewType === "landing"
                                ? "landing"
                                : "product",
                            landingPageId: product.upsellLandingPageId
                              ? String(product.upsellLandingPageId)
                              : "",
                          })
                        }
                        className="rounded-xl text-xs font-extrabold"
                      >
                        <Pencil className="ml-1.5 size-3.5" /> تعديل
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `حذف العرض التكميلي للـ«${product.title}»؟`
                            )
                          ) {
                            // upsellProductId = null clears every upsell column.
                            setUpsell.mutate({
                              productId: product.id,
                              upsellProductId: null,
                            });
                          }
                        }}
                        className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white text-[#b03a2e]"
                        title="حذف الـUpsell"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )
      ) : offers.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-[#E7E9E2] bg-white py-16">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : tabRows.length === 0 ? (
        <Card className="rounded-2xl border-[#E7E9E2]">
          <CardContent className="py-14 text-center text-sm text-[#73758a]">
            {tab === "bundle"
              ? "لا باقات بعد. اضغط «إضافة باقة»."
              : "لا عروض خصم كمية بعد. اضغط «إضافة خصم كمية»."}
          </CardContent>
        </Card>
      ) : tab === "quantity" ? (
        /* One card per product; its tiers are listed inside. */
        <div className="space-y-3">
          {quantityGroups.map(group => (
            <Card
              key={group.productId}
              className="overflow-hidden rounded-2xl border-[#E7E9E2]"
            >
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-[#F1F3F2] px-4 py-3">
                  <span className="font-extrabold text-[#181a2b]">
                    {group.title}
                  </span>
                  <Badge className="rounded-full bg-[#EEF2FF] text-[#3730A3] hover:bg-[#EEF2FF]">
                    {group.rows.length} طبقة
                  </Badge>
                </div>
                <ul className="divide-y divide-[#F1F3F2]">
                  {group.rows.map(row => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                    >
                      <span className="text-[13px] font-extrabold">
                        {row.items[0]?.quantity ?? 1} قطعة
                      </span>
                      <span className="text-[13px] font-extrabold text-[var(--brand)]">
                        {money(row.pricing.bundlePrice)}
                      </span>
                      {row.pricing.savingPercent > 0 ? (
                        <span className="rounded-full bg-[#e4f3ef] px-2 py-0.5 text-[11px] font-bold text-[#0B5D57]">
                          توفير {row.pricing.savingPercent}%
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#9aa39d]">
                        {row.name}
                        {row.maxUses > 0 ? ` · ${row.usedCount}/${row.maxUses}` : ""}
                      </span>
                      {row.freeDelivery ? (
                        <Badge className="rounded-full bg-[#e4f3ef] text-[var(--brand)] hover:bg-[#e4f3ef]">
                          <Truck className="ml-1 size-3" /> توصيل مجاني
                        </Badge>
                      ) : null}
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={checked => toggleActive(row.id, checked)}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          setDraft({
                            id: row.id,
                            kind: "quantity",
                            name: row.name,
                            slug: row.slug,
                            imageUrl: row.imageUrl ?? "",
                            discountType: "percent",
                            discountValue: "",
                            productId: row.items[0] ? String(row.items[0].productId) : "",
                            tiers: [
                              {
                                quantity: row.items[0]
                                  ? String(row.items[0].quantity)
                                  : "",
                                price: row.fixedPrice ?? "",
                                description: row.name,
                                maxUses: String(row.maxUses ?? 0),
                                freeDelivery: row.freeDelivery,
                              },
                            ],
                            quantity: row.items[0] ? String(row.items[0].quantity) : "2",
                            fixedPrice: row.fixedPrice ?? "",
                            maxUses: String(row.maxUses ?? 0),
                            freeDelivery: row.freeDelivery,
                            isActive: row.isActive,
                          })
                        }
                        className="rounded-xl text-xs font-extrabold"
                      >
                        <Pencil className="ml-1.5 size-3.5" /> تعديل
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`حذف طبقة ${row.items[0]?.quantity ?? 1} قطعة؟`)) {
                            remove.mutate({ id: row.id });
                          }
                        }}
                        className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white text-[#b03a2e]"
                        title="حذف الطبقة"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl border-[#E7E9E2]">
          <CardContent className="p-0">
            <ul className="divide-y divide-[#F1F3F2]">
              {tabRows.map((row, index) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(row.id, -1)}
                      disabled={index === 0}
                      className="text-[#9fb0ac] disabled:opacity-30"
                      title="تحريك للأعلى"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(row.id, 1)}
                      disabled={index === rows.length - 1}
                      className="text-[#9fb0ac] disabled:opacity-30"
                      title="تحريك للأسفل"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                  <span
                    className="size-11 shrink-0 rounded-xl border border-[#E7E9E2] bg-[#F7F7F3] bg-cover bg-center"
                    style={
                      row.imageUrl
                        ? { backgroundImage: `url(${row.imageUrl})` }
                        : row.items[0]?.price
                          ? undefined
                          : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-extrabold text-[#181a2b]">
                        {row.name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          row.kind === "quantity"
                            ? "bg-[#EEF2FF] text-[#3730A3]"
                            : "bg-[#e4f3ef] text-[#0B5D57]"
                        }`}
                      >
                        {row.kind === "quantity" ? "خصم كمية" : "باقة"}
                      </span>
                      {row.freeDelivery ? (
                        <Badge className="rounded-full bg-[#e4f3ef] text-[var(--brand)] hover:bg-[#e4f3ef]">
                          <Truck className="ml-1 size-3" /> توصيل مجاني
                        </Badge>
                      ) : null}
                      {row.unavailableReason ? (
                        <span
                          className="rounded-full bg-[#FDF1DC] px-2.5 py-1 text-[11px] font-bold text-[#B45309]"
                          title="لن يظهر في المتجر حتى يُصلح."
                        >
                          لن يظهر: {row.unavailableReason}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-[#9aa39d]">
                      {row.kind === "quantity"
                        ? `${row.items[0]?.quantity ?? 1} × ${row.items[0]?.title ?? "منتج"}`
                        : `${row.items.length} منتج`}{" "}
                      ·{" "}
                      <span className="line-through">{money(row.pricing.originalTotal)}</span>{" "}
                      <span className="font-extrabold text-[var(--brand)]">
                        {money(row.pricing.bundlePrice)}
                      </span>
                      {row.pricing.savingPercent > 0
                        ? ` · توفير ${row.pricing.savingPercent}%`
                        : ""}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11.5px] font-bold text-[#576B66]">
                    {row.isActive ? "مفعّل" : "معطّل"}
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={checked => toggleActive(row.id, checked)}
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    {/* ⚙ is for BUNDLES only: a quantity deal is one product,
                        edited through the normal edit dialog. */}
                    {row.kind !== "quantity" ? (
                      <button
                        type="button"
                        onClick={() => openProducts(row)}
                        className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white"
                        title="إدارة منتجات العرض"
                      >
                        <Settings2 className="size-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          id: row.id,
                          kind: row.kind === "quantity" ? "quantity" : "bundle",
                          name: row.name,
                          slug: row.slug,
                          imageUrl: row.imageUrl ?? "",
                          discountType: (row.discountType ?? "") as Draft["discountType"],
                          discountValue: row.discountValue ?? "",
                          productId: row.items[0] ? String(row.items[0].productId) : "",
                          tiers: [
                            {
                              quantity: row.items[0] ? String(row.items[0].quantity) : "",
                              price: row.fixedPrice ?? "",
                              description: row.name,
                              maxUses: String(row.maxUses ?? 0),
                              freeDelivery: row.freeDelivery,
                            },
                          ],
                          quantity: row.items[0] ? String(row.items[0].quantity) : "2",
                          fixedPrice: row.fixedPrice ?? "",
                          maxUses: String(row.maxUses ?? 0),
                          freeDelivery: row.freeDelivery,
                          isActive: row.isActive,
                        })
                      }
                      className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white"
                      title="تعديل"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`حذف العرض «${row.name}»؟`)) {
                          remove.mutate({ id: row.id });
                        }
                      }}
                      className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white text-[#b03a2e]"
                      title="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}


      {/* Upsell bridge form (writes the product's upsell columns only). */}
      <Dialog
        open={Boolean(upsellDraft)}
        onOpenChange={open => {
          if (!open) setUpsellDraft(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-right font-black">
              🔥 Smart Checkout Upsell
            </DialogTitle>
            <DialogDescription className="text-right">
              بعد ما يضغط العميل «اطلب الآن»، أظهر له منتج إضافي بسعر مخفض قبل
              تأكيد الطلب.
            </DialogDescription>
          </DialogHeader>
          {upsellDraft ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block font-bold">المنتج الأساسي</Label>
                <select
                  value={upsellDraft.productId}
                  onChange={event =>
                    setUpsellDraft({ ...upsellDraft, productId: event.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold"
                >
                  <option value="">اختر منتجًا…</option>
                  {visibleProducts.map(product => (
                    <option key={product.id} value={String(product.id)}>
                      {product.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">المنتج المُقترح</Label>
                <select
                  value={upsellDraft.upsellProductId}
                  onChange={event =>
                    setUpsellDraft({
                      ...upsellDraft,
                      upsellProductId: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold"
                >
                  <option value="">بدون (إزالة الـUpsell)</option>
                  {visibleProducts
                    .filter(product => String(product.id) !== upsellDraft.productId)
                    .map(product => (
                      <option key={product.id} value={String(product.id)}>
                        {product.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block font-bold">
                    السعر الخاص (اختياري)
                  </Label>
                  <Input
                    dir="ltr"
                    inputMode="decimal"
                    value={upsellDraft.upsellPrice}
                    onChange={event =>
                      setUpsellDraft({
                        ...upsellDraft,
                        upsellPrice: event.target.value,
                      })
                    }
                    placeholder="اتركه فارغًا لسعر المنتج"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block font-bold">خصم إضافي</Label>
                  <div className="flex gap-2">
                    <select
                      value={upsellDraft.discountMode}
                      onChange={event =>
                        setUpsellDraft({
                          ...upsellDraft,
                          discountMode: event.target.value as UpsellDraft["discountMode"],
                        })
                      }
                      className="h-11 w-28 rounded-xl border border-[#E3E1D8] bg-white px-2 text-sm font-bold"
                    >
                      <option value="">بدون</option>
                      <option value="percent">%</option>
                      <option value="amount">مبلغ</option>
                    </select>
                    <Input
                      dir="ltr"
                      inputMode="decimal"
                      disabled={!upsellDraft.discountMode}
                      value={upsellDraft.discountValue}
                      onChange={event =>
                        setUpsellDraft({
                          ...upsellDraft,
                          discountValue: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">
                  ماذا يظهر للمشتري في النافذة؟
                </Label>
                <select
                  value={upsellDraft.viewType}
                  onChange={event =>
                    setUpsellDraft({
                      ...upsellDraft,
                      viewType: event.target.value as UpsellDraft["viewType"],
                    })
                  }
                  className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold"
                >
                  {/* The upsell product's OWN product page, or its landing page. */}
                  <option value="product">صفحة المنتج</option>
                  <option value="landing">صفحة الهبوط (فانل)</option>
                </select>
              </div>
              {upsellDraft.viewType === "landing" ? (
                <div>
                  <Label className="mb-1.5 block font-bold">معرّف صفحة الهبوط</Label>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={upsellDraft.landingPageId}
                    onChange={event =>
                      setUpsellDraft({
                        ...upsellDraft,
                        landingPageId: event.target.value,
                      })
                    }
                    placeholder="123"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUpsellDraft(null)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={saveUpsell}
              disabled={setUpsell.isPending}
              className="rounded-xl brand-shine cta-gradient font-extrabold"
            >
              {setUpsell.isPending ? "…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* create / edit */}
      <Dialog open={Boolean(draft)} onOpenChange={open => !open && setDraft(null)}>
        <DialogContent
          dir="rtl"
          className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-right font-black">
              {draft?.id
                ? draft.kind === "quantity"
                  ? "تعديل طبقة"
                  : "تعديل باقة"
                : draft?.kind === "quantity"
                  ? "إضافة خصم كمية (طبقات)"
                  : "إضافة باقة"}
            </DialogTitle>
            <DialogDescription className="text-right">
              الخصم يُحسب على مجموع أسعار منتجات العرض. لا يوجد سعر يدوي.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">

              {draft.kind === "quantity" ? (
                <>
                  <div>
                    <Label className="mb-1.5 block font-bold">المنتج</Label>
                    <select
                      value={draft.productId}
                      onChange={event =>
                        setDraft({ ...draft, productId: event.target.value })
                      }
                      className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold"
                    >
                      <option value="">اختر منتجًا…</option>
                      {visibleProducts.map(product => (
                        <option key={product.id} value={String(product.id)}>
                          {product.title} — {money(Number(product.price ?? 0))}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* One row per tier: "1 piece at X, 2 at Y, ..." — created
                      together (the legacy behaviour). */}
                  <div className="rounded-xl border border-[#E7E9E2] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-black">
                        الطبقات (قطعة بـX، قطعتان بـY…)
                      </span>
                      {!draft.id && draft.tiers.length < 20 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, tiers: [...draft.tiers, emptyTier()] })
                          }
                          className="rounded-md px-2 py-1 text-[11px] font-extrabold text-[#0B5D57] hover:bg-[#f7faf9]"
                        >
                          + إضافة طبقة
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {draft.tiers.map((tier, index) => (
                        <div
                          key={index}
                          className="grid gap-2 rounded-lg bg-[#FBFCFC] p-2 sm:grid-cols-[70px_100px_1fr_90px_auto]"
                        >
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            value={tier.quantity}
                            placeholder="الكمية"
                            onChange={event => {
                              const tiers = [...draft.tiers];
                              tiers[index] = { ...tier, quantity: event.target.value };
                              setDraft({ ...draft, tiers });
                            }}
                          />
                          <Input
                            dir="ltr"
                            inputMode="decimal"
                            value={tier.price}
                            placeholder="السعر"
                            onChange={event => {
                              const tiers = [...draft.tiers];
                              tiers[index] = { ...tier, price: event.target.value };
                              setDraft({ ...draft, tiers });
                            }}
                          />
                          <Input
                            value={tier.description}
                            placeholder="الوصف (يظهر للعميل)"
                            onChange={event => {
                              const tiers = [...draft.tiers];
                              tiers[index] = {
                                ...tier,
                                description: event.target.value,
                              };
                              setDraft({ ...draft, tiers });
                            }}
                          />
                          {/* Per-tier usage limit: each tier has its own. */}
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            value={tier.maxUses}
                            placeholder="مرات"
                            title="عدد مرات الاستعمال (0 = بلا حد)"
                            onChange={event => {
                              const tiers = [...draft.tiers];
                              tiers[index] = { ...tier, maxUses: event.target.value };
                              setDraft({ ...draft, tiers });
                            }}
                          />
                          {!draft.id && draft.tiers.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  tiers: draft.tiers.filter((_, i) => i !== index),
                                })
                              }
                              className="rounded-lg px-2 text-xs font-bold text-[#b03a2e]"
                            >
                              حذف
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#9aa39d]">
                      الكمية · السعر · الوصف · عدد المرات (0 = بلا حد). نفس
                      السعر مسموح؛ كيُرفض فقط سعر أعلى من السعر العادي (الكمية ×
                      سعر الوحدة).
                    </p>
                  </div>
                </>
              ) : null}

              <div className={draft.kind === "quantity" ? "hidden" : ""}>
              <div>
                <Label className="mb-1.5 block font-bold">اسم العرض</Label>
                <Input
                  value={draft.name}
                  onChange={event => setDraft({ ...draft, name: event.target.value })}
                  placeholder="مثال: باقة الصيف"
                />
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">المعرّف (اختياري)</Label>
                <Input
                  dir="ltr"
                  value={draft.slug}
                  onChange={event => setDraft({ ...draft, slug: event.target.value })}
                  placeholder={slugPreview(draft.name) || "summer-bundle"}
                />
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">صورة العرض (اختيارية)</Label>
                <div className="flex items-center gap-3">
                  <span
                    className="size-14 rounded-xl border border-[#E7E9E2] bg-[#F7F7F3] bg-cover bg-center"
                    style={
                      draft.imageUrl
                        ? { backgroundImage: `url(${draft.imageUrl})` }
                        : undefined
                    }
                  />
                  <label className="cursor-pointer rounded-lg border border-[#E7E9E2] px-3 py-2 text-xs font-bold">
                    {uploading ? "جارٍ الرفع…" : "اختيار صورة"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void pickImage(file);
                      }}
                    />
                  </label>
                  {draft.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, imageUrl: "" })}
                      className="text-xs font-bold text-[#b03a2e]"
                    >
                      إزالة
                    </button>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-[#9aa39d]">
                  إذا ما رفعتيش صورة، تُستعمل صورة أول منتج في العرض.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block font-bold">نوع الخصم</Label>
                  <select
                    value={draft.discountType}
                    onChange={event =>
                      setDraft({
                        ...draft,
                        discountType: event.target.value as Draft["discountType"],
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold"
                  >
                    <option value="">بدون خصم</option>
                    <option value="percent">نسبة %</option>
                    <option value="amount">مبلغ ثابت</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 block font-bold">
                    {draft.discountType === "percent" ? "النسبة (1–95)" : "المبلغ (دج)"}
                  </Label>
                  <Input
                    dir="ltr"
                    inputMode="decimal"
                    disabled={!draft.discountType}
                    value={draft.discountValue}
                    onChange={event =>
                      setDraft({ ...draft, discountValue: event.target.value })
                    }
                    placeholder={draft.discountType === "percent" ? "10" : "500"}
                  />
                </div>
              </div>

              {/* Products are chosen INSIDE the create form (a bundle without
                  products is meaningless). ⚙ only for later changes. */}
              {!draft.id ? (
                <div className="rounded-xl border border-[#E7E9E2] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-black">منتجات الباقة</span>
                    <span className="text-[11px] text-[#9aa39d]">
                      {pickedItems.length} مختار
                    </span>
                  </div>
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39d]" />
                    <Input
                      value={filter}
                      onChange={event => setFilter(event.target.value)}
                      placeholder="ابحث في المنتجات…"
                      className="pr-9"
                    />
                  </div>
                  {products.isLoading ? (
                    <div className="grid place-items-center py-6">
                      <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
                    </div>
                  ) : visibleProducts.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#73758a]">
                      لا منتجات. أضف منتجًا أولًا من صفحة المنتجات.
                    </p>
                  ) : (
                    <ul className="max-h-52 space-y-1 overflow-y-auto">
                      {visibleProducts.map(product => {
                        const quantity = picked[product.id] ?? 0;
                        return (
                          <li key={product.id}>
                            <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-[#F7F7F3]">
                              <input
                                type="checkbox"
                                checked={quantity > 0}
                                onChange={event =>
                                  setPicked(current => {
                                    const next = { ...current };
                                    if (event.target.checked) next[product.id] = 1;
                                    else delete next[product.id];
                                    return next;
                                  })
                                }
                                className="size-4 accent-[var(--brand)]"
                              />
                              <span className="min-w-0 flex-1 truncate font-bold">
                                {product.title}
                              </span>
                              {quantity > 0 ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={quantity}
                                  onChange={event =>
                                    setPicked(current => ({
                                      ...current,
                                      [product.id]: Math.min(
                                        Math.max(Number(event.target.value) || 1, 1),
                                        99
                                      ),
                                    }))
                                  }
                                  className="h-8 w-16 rounded-lg border border-[#E7E9E2] px-2 text-center"
                                />
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pickedItems.length > 0 && pickedItems.length < 2 ? (
                    <p className="mt-2 text-[11px] font-bold text-[#B45309]">
                      الباقة تحتاج منتجين على الأقل.
                    </p>
                  ) : null}
                </div>
              ) : null}
              </div>

              <label className="flex items-center justify-between rounded-xl border border-[#E7E9E2] p-3 text-sm font-bold">
                توصيل مجاني على الطلبية كاملة
                <Switch
                  checked={draft.freeDelivery}
                  onCheckedChange={checked =>
                    setDraft({ ...draft, freeDelivery: checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-[#E7E9E2] p-3 text-sm font-bold">
                العرض مفعّل
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={checked => setDraft({ ...draft, isActive: checked })}
                />
              </label>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={save}
              disabled={create.isPending || update.isPending}
              className="rounded-xl brand-shine cta-gradient font-extrabold"
            >
              {create.isPending || update.isPending ? "…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* products + quantities */}
      <Dialog
        open={Boolean(managing)}
        onOpenChange={open => {
          if (!open) setManaging(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-right font-black">
              منتجات «{managing?.name}»
            </DialogTitle>
            <DialogDescription className="text-right">
              اختر المنتجات وحدّد كمية كل واحد. المنتج الواحد يقدر يكون في عدة
              عروض في نفس الوقت.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39d]" />
              <Input
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="ابحث في المنتجات…"
                className="pr-9"
              />
            </div>

            {products.isLoading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
              </div>
            ) : visibleProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#73758a]">
                لا منتجات مطابقة.
              </p>
            ) : (
              <ul className="max-h-[46vh] space-y-1 overflow-y-auto rounded-xl border border-[#E7E9E2] p-2">
                {visibleProducts.map(product => {
                  const quantity = picked[product.id] ?? 0;
                  return (
                    <li key={product.id}>
                      <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[#F7F7F3]">
                        <input
                          type="checkbox"
                          checked={quantity > 0}
                          onChange={event =>
                            setPicked(current => {
                              const next = { ...current };
                              if (event.target.checked) next[product.id] = 1;
                              else delete next[product.id];
                              return next;
                            })
                          }
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {product.title}
                          </span>
                          <span className="text-[11px] text-[#9aa39d]">
                            {money(Number(product.price ?? 0))}
                          </span>
                        </span>
                        {quantity > 0 ? (
                          <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#576B66]">
                            الكمية
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={quantity}
                              onChange={event =>
                                setPicked(current => ({
                                  ...current,
                                  [product.id]: Math.min(
                                    Math.max(Number(event.target.value) || 1, 1),
                                    99
                                  ),
                                }))
                              }
                              className="h-9 w-20 rounded-lg border border-[#E7E9E2] px-2 text-center"
                            />
                          </label>
                        ) : null}
                        <Badge variant="secondary" className="rounded-full">
                          {product.status === "active" ? "منشور" : "مسودة"}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center justify-between text-xs text-[#73758a]">
              <span>{pickedItems.length} منتج مختار</span>
              <button
                type="button"
                onClick={() => {
                  setManaging(null);
                  window.location.href = "/products/create";
                }}
                className="font-extrabold text-[var(--brand)]"
              >
                + إضافة منتج جديد
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManaging(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={() =>
                managing &&
                setProducts.mutate({ offerId: managing.id, items: pickedItems })
              }
              disabled={setProducts.isPending}
              className="rounded-xl brand-shine cta-gradient font-extrabold"
            >
              {setProducts.isPending ? "…" : "حفظ المنتجات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
