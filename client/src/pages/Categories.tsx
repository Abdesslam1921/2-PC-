import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
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

type Draft = {
  id?: number;
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
};

const emptyDraft: Draft = { name: "", slug: "", imageUrl: "", isActive: true };

const slugPreview = (value: string) =>
  value
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

export default function Categories() {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Category whose product list is being edited. */
  const [assigning, setAssigning] = useState<{ id: number; name: string } | null>(
    null
  );
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [productFilter, setProductFilter] = useState("");

  const categories = trpc.categories.list.useQuery();
  const products = trpc.products.list.useQuery(undefined, {
    enabled: Boolean(assigning),
  });
  const [ordered, setOrdered] = useState<number[] | null>(null);
  const rows = ordered
    ? [...(categories.data ?? [])].sort(
        (a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id)
      )
    : categories.data ?? [];

  const invalidate = () => void utils.categories.list.invalidate();

  const create = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة الفئة.");
      setDraft(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفئة.");
      setDraft(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.categories.remove.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفئة.");
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reorder = trpc.categories.reorder.useMutation({
    onSuccess: () => {
      invalidate();
      setOrdered(null);
    },
    onError: error => {
      toast.error(error.message);
      setOrdered(null);
    },
  });
  const setProducts = trpc.categories.setProducts.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث منتجات الفئة.");
      setAssigning(null);
      invalidate();
      // The picker pre-fills from products.list: refresh it so a product moved
      // to another category never looks like it is in two categories.
      void utils.products.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const uploadAsset = trpc.storefront.uploadAsset.useMutation();

  /** Toggling active state straight from the list row. */
  const toggleActive = (id: number, isActive: boolean) =>
    update.mutate({ id, isActive });

  const openProducts = (row: { id: number; name: string }) => {
    const preselected = (products.data ?? [])
      .filter(
        (product): product is NonNullable<typeof product> =>
          product != null && product.categoryId === row.id
      )
      .map(product => product.id);
    setSelectedProducts(preselected);
    setProductFilter("");
    setAssigning({ id: row.id, name: row.name });
  };

  const visibleProducts = useMemo(() => {
    const query = productFilter.trim().toLowerCase();
    const list = (products.data ?? []).filter(
      (product): product is NonNullable<typeof product> => product != null
    );
    if (!query) return list;
    return list.filter(product =>
      (product.title ?? "").toLowerCase().includes(query)
    );
  }, [products.data, productFilter]);

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("اسم الفئة مطلوب.");
      return;
    }
    const payload = {
      name,
      slug: draft.slug.trim() || slugPreview(name),
      imageUrl: draft.imageUrl.trim(),
      isActive: draft.isActive,
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

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-[#181a2b]">
            <FolderTree className="size-5 text-[var(--brand)]" /> الفئات
          </h1>
          <p className="mt-1 text-sm text-[#73758a]">
            فئة واحدة لكل منتج. الفئات النشطة تظهر في واجهة المتجر وفي صفحة
            الفئة <span dir="ltr">/store/category/&lt;slug&gt;</span>. يظهر في
            المتجر فقط ما فيه منتج <b>منشور</b> واحد على الأقل — والمنتج ينتمي
            لفئة واحدة، فاختياره هنا ينقله من فئته السابقة.
          </p>
        </div>
        <Button
          onClick={() => setDraft({ ...emptyDraft })}
          className="h-11 rounded-xl brand-shine cta-gradient px-4 font-extrabold"
        >
          <Plus className="ml-1.5 size-4" /> إضافة فئة
        </Button>
      </div>

      {categories.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-[#E7E9E2] bg-white py-16">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl border-[#E7E9E2]">
          <CardContent className="py-14 text-center text-sm text-[#73758a]">
            لا فئات بعد. أضف أول فئة واربط بها منتجاتك.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl border-[#E7E9E2]">
          <CardContent className="p-0">
            <ul className="divide-y divide-[#F1F3F2]">
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
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
                      row.imageUrl ? { backgroundImage: `url(${row.imageUrl})` } : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-extrabold text-[#181a2b]">
                        {row.name}
                      </span>
                      {!row.isActive ? (
                        <Badge variant="secondary" className="rounded-full">
                          معطّلة
                        </Badge>
                      ) : null}
                    </div>
                    <div
                      dir="ltr"
                      className="truncate text-xs text-[#9aa39d]"
                    >
                      /store/category/{row.slug}
                    </div>
                  </div>
                  <Badge className="rounded-full bg-[#e4f3ef] text-[var(--brand)] hover:bg-[#e4f3ef]">
                    {row.productCount} منتج
                  </Badge>
                  {row.isActive && row.activeProductCount === 0 ? (
                    <span
                      className="rounded-full bg-[#FDF1DC] px-2.5 py-1 text-[11px] font-bold text-[#B45309]"
                      title="المتجر يعرض فقط الفئات التي فيها منتج منشور واحد على الأقل."
                    >
                      لن تظهر في المتجر: لا منتج منشور ({row.productCount} مسودة)
                    </span>
                  ) : null}
                  <label
                    className="flex items-center gap-2 text-[11.5px] font-bold text-[#576B66]"
                    title={row.isActive ? "الفئة مفعّلة" : "الفئة معطّلة"}
                  >
                    {row.isActive ? "مفعّلة" : "معطّلة"}
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={checked => toggleActive(row.id, checked)}
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openProducts(row)}
                      className="grid size-9 place-items-center rounded-lg border border-[#E7E9E2] bg-white"
                      title="إدارة منتجات الفئة"
                    >
                      <Settings2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          id: row.id,
                          name: row.name,
                          slug: row.slug,
                          imageUrl: row.imageUrl ?? "",
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
                        if (row.productCount > 0) {
                          toast.error(
                            `لا يمكن حذف «${row.name}»: ${row.productCount} منتج مرتبط بها. افصل المنتجات أولًا من صفحة المنتج.`
                          );
                          return;
                        }
                        if (confirm(`حذف الفئة «${row.name}»؟`)) {
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

      <Dialog open={Boolean(draft)} onOpenChange={open => !open && setDraft(null)}>
        <DialogContent dir="rtl" className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-right font-black">
              {draft?.id ? "تعديل فئة" : "إضافة فئة"}
            </DialogTitle>
            <DialogDescription className="text-right">
              الاسم يظهر في المتجر، والمعرّف يُستعمل في رابط صفحة الفئة.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block font-bold">اسم الفئة</Label>
                <Input
                  value={draft.name}
                  onChange={event => setDraft({ ...draft, name: event.target.value })}
                  placeholder="مثال: ملابس"
                />
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">
                  المعرّف (slug) — اختياري
                </Label>
                <Input
                  dir="ltr"
                  value={draft.slug}
                  onChange={event => setDraft({ ...draft, slug: event.target.value })}
                  placeholder={slugPreview(draft.name) || "clothes"}
                />
                <p className="mt-1.5 text-xs text-[#9aa39d]">
                  يُولَّد تلقائيًا من الاسم إذا تُرك فارغًا.
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block font-bold">صورة الفئة</Label>
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
              </div>
              <label className="flex items-center justify-between rounded-xl border border-[#E7E9E2] p-3 text-sm font-bold">
                الفئة نشطة (تظهر في المتجر)
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={checked =>
                    setDraft({ ...draft, isActive: checked })
                  }
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

      {/* Manage the products of one category (one category per product). */}
      <Dialog
        open={Boolean(assigning)}
        onOpenChange={open => {
          if (!open) setAssigning(null);
        }}
      >
        <DialogContent dir="rtl" className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-right font-black">
              منتجات «{assigning?.name}»
            </DialogTitle>
            <DialogDescription className="text-right">
              اختر المنتجات التي تنتمي لهذه الفئة. المنتج ينتمي لفئة واحدة —
              اختياره هنا ينقله من فئته السابقة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39d]" />
              <Input
                value={productFilter}
                onChange={event => setProductFilter(event.target.value)}
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
                لا منتجات مطابقة. أضف منتجًا جديدًا من الزر أسفله.
              </p>
            ) : (
              <ul className="max-h-[46vh] space-y-1 overflow-y-auto rounded-xl border border-[#E7E9E2] p-2">
                {visibleProducts.map(product => {
                  const checked = selectedProducts.includes(product.id);
                  const otherCategory =
                    product.categoryId && product.categoryId !== assigning?.id
                      ? "منتقل من فئة أخرى"
                      : null;
                  return (
                    <li key={product.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[#F7F7F3]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event =>
                            setSelectedProducts(current =>
                              event.target.checked
                                ? [...current, product.id]
                                : current.filter(id => id !== product.id)
                            )
                          }
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className="size-9 shrink-0 rounded-lg border border-[#E7E9E2] bg-[#F7F7F3] bg-cover bg-center" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {product.title}
                          </span>
                          {otherCategory ? (
                            <span className="text-[11px] text-[#B45309]">
                              {otherCategory}
                            </span>
                          ) : null}
                        </span>
                        <Badge variant="secondary" className="rounded-full">
                          {product.status === "active" ? "منشور" : "مسودة"}
                        </Badge>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center justify-between text-xs text-[#73758a]">
              <span>{selectedProducts.length} منتج مختار</span>
              <button
                type="button"
                onClick={() => {
                  setAssigning(null);
                  window.location.href = `/products/create?categoryId=${assigning?.id ?? ""}`;
                }}
                className="font-extrabold text-[var(--brand)]"
              >
                + إضافة منتج جديد لهذه الفئة
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAssigning(null)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={() =>
                assigning &&
                setProducts.mutate({
                  categoryId: assigning.id,
                  productIds: selectedProducts,
                })
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
