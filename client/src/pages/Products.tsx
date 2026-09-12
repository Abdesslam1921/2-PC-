import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Boxes,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  PackagePlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatCreatedAt(value: Date | string) {
  return new Intl.DateTimeFormat("ar-DZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function Products() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const products = (productsQuery.data ?? []).filter(
    (product): product is NonNullable<typeof product> => Boolean(product)
  );
  const [deleting, setDeleting] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const duplicateProduct = trpc.products.duplicate.useMutation({
    onSuccess: product => {
      utils.products.list.invalidate();
      toast.success(`تم تكرار «${product.title}» كمسودة جديدة.`);
    },
    onError: error => toast.error(error.message || "تعذر تكرار المنتج."),
  });
  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("تم حذف المنتج من الكتالوج.");
      setDeleting(null);
    },
    onError: error => toast.error(error.message || "تعذر حذف المنتج."),
  });

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <PageIntro
        eyebrow="الكتالوج"
        title="المنتجات"
        description="أدر منتجاتك وأسعارها ومخزونها من جدول واحد واضح وسريع."
        action={
          <Button
            onClick={() => setLocation("/products/create")}
            className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-bold shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
          >
            <PackagePlus className="ml-2 size-4" />
            إضافة منتج
          </Button>
        }
      />

      {authLoading || productsQuery.isLoading ? (
        <div className="grid min-h-72 place-items-center rounded-[24px] border border-[#E7E9E2] bg-white shadow-soft">
          <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
        </div>
      ) : !isAuthenticated ? (
        <EmptyState
          icon={Boxes}
          title="سجّل الدخول لإدارة كتالوجك"
          description="ستظهر منتجاتك الخاصة بعد تسجيل الدخول إلى حساب الإدارة."
        />
      ) : (
        <section className="overflow-hidden rounded-[20px] border border-[#E7E9E2] bg-white shadow-soft animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-right">
              <thead className="bg-[#F5F6F2] text-xs font-extrabold text-[#1F2A25]">
                <tr className="h-15 border-b border-[#E7E9E2]">
                  <th className="w-14 px-4">
                    <input
                      aria-label="اختيار كل المنتجات"
                      type="checkbox"
                      className="size-4 rounded accent-[var(--brand)]"
                    />
                  </th>
                  <th className="min-w-75 px-5">المنتج</th>
                  <th className="min-w-45 px-5">تم الإنشاء</th>
                  <th className="w-28 px-5">الطلبات</th>
                  <th className="w-34 px-5">السعر</th>
                  <th className="w-54 px-5">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          <Boxes className="size-5" />
                        </div>
                        <p className="mt-4 text-sm font-extrabold text-[#1F2A25]">
                          لا توجد منتجات بعد
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#8A938D]">
                          أضف أول منتج ليظهر هنا مع السعر والإجراءات ورابط صفحة
                          الهبوط.
                        </p>
                        <Button
                          onClick={() => setLocation("/products/create")}
                          className="btn-press mt-4 rounded-xl bg-[var(--brand)] text-xs shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
                        >
                          <PackagePlus className="ml-2 size-4" />
                          إضافة منتج
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map(product => {
                    const image = product.images[0]?.url;
                    const displayedPrice =
                      product.price ?? product.variants[0]?.price ?? "0.00";
                    return (
                      <tr
                        key={product.id}
                        className="h-19 border-b border-[#EDEFE8] last:border-b-0 transition-colors duration-200 hover:bg-[#FAFBF7]"
                      >
                        <td className="px-4">
                          <input
                            aria-label={`اختيار ${product.title}`}
                            type="checkbox"
                            className="size-4 rounded accent-[var(--brand)]"
                          />
                        </td>
                        <td className="px-5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid size-13 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#F1F2EC]">
                              {image ? (
                                <img
                                  src={image}
                                  alt={product.title}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-5 text-[#9FB3A8]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <button
                                onClick={() =>
                                  setLocation(`/products/${product.id}/edit`)
                                }
                                className="block max-w-65 truncate text-sm font-extrabold text-[var(--brand)] transition-colors duration-200 hover:text-[var(--brand-strong)]"
                              >
                                {product.title}
                              </button>
                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${product.status === "active" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F0F1EC] text-[#79837D]"}`}
                              >
                                {product.status === "active"
                                  ? "منشور"
                                  : "مسودة"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 text-sm font-semibold text-[#8A938D]">
                          {formatCreatedAt(product.createdAt)}
                        </td>
                        <td className="px-5 text-sm font-bold text-[#8A938D]">
                          0
                        </td>
                        <td className="px-5 text-sm font-extrabold text-[#1F2A25]">
                          {displayedPrice} دج
                        </td>
                        <td className="px-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                window.open(
                                  `/p/${product.id}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              aria-label={`فتح صفحة هبوط ${product.title}`}
                              title="فتح صفحة الهبوط في تبويب جديد"
                              className="btn-press grid size-8 place-items-center rounded-lg border border-[#E3E1D8] bg-white text-[var(--brand)] transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            >
                              <ExternalLink className="size-4" />
                            </button>
                            <button
                              onClick={() =>
                                setLocation(`/products/${product.id}/edit`)
                              }
                              aria-label={`تعديل ${product.title}`}
                              title="تعديل المنتج"
                              className="btn-press grid size-8 place-items-center rounded-lg border border-[#E3E1D8] bg-white text-[#4A554F] transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              disabled={duplicateProduct.isPending}
                              onClick={() =>
                                duplicateProduct.mutate({ id: product.id })
                              }
                              aria-label={`تكرار ${product.title}`}
                              title="تكرار المنتج"
                              className="btn-press grid size-8 place-items-center rounded-lg border border-[#E3E1D8] bg-white text-[#4A554F] transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] disabled:opacity-50"
                            >
                              <Copy className="size-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleting({
                                  id: product.id,
                                  title: product.title,
                                })
                              }
                              aria-label={`حذف ${product.title}`}
                              title="حذف المنتج"
                              className="btn-press grid size-8 place-items-center rounded-lg border border-[#E3E1D8] bg-white text-[#4A554F] transition-colors duration-200 hover:border-[#F3D2CB] hover:bg-[#FCE8E4] hover:text-[#A63D28]"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#EDEFE8] px-5 py-4 text-xs text-[#79837D]">
            <span>1 من 1 صفحة · {products.length} منتجات</span>
            <div className="flex gap-2">
              <button
                disabled
                className="grid size-8 place-items-center rounded-lg border border-[#E3E1D8] text-[#B6BCB2]"
              >
                ‹
              </button>
              <button
                disabled
                className="grid size-8 place-items-center rounded-lg border border-[#E3E1D8] text-[#B6BCB2]"
              >
                ›
              </button>
            </div>
          </div>
        </section>
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
      >
        <AlertDialogContent
          dir="rtl"
          className="rounded-[24px] border-[#E7E9E2]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-[#1F2A25]">
              حذف المنتج؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-6">
              سيُحذف «{deleting?.title}» مع متغيراته من كتالوجك. لا يمكن التراجع
              عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <AlertDialogCancel className="btn-press m-0 rounded-xl">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting && deleteProduct.mutate({ id: deleting.id })
              }
              className="btn-press m-0 rounded-xl bg-[#A63D28] hover:bg-[#8E3320]"
            >
              حذف المنتج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
