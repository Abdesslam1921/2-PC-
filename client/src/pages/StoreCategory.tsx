import { ArrowRight, Loader2, PackageOpen, Search, ShoppingCart } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

const formatPrice = (value: string | null | undefined, currency = "DZD") =>
  value
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(
        Number(value)
      )} ${currency === "EUR" ? "€" : currency === "USD" ? "$" : "دج"}`
    : "—";

/**
 * Public category page: /store/category/<slug>
 *
 * Data comes from `categories.publicGet`, which is fail-closed on the server
 * (no resolved store, unknown slug or inactive category → NOT_FOUND), exactly
 * like `products.publicGet`. The page therefore never renders another tenant's
 * category and never guesses a fallback category.
 */
export default function StoreCategory() {
  const [, params] = useRoute("/store/category/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";

  const query = trpc.categories.publicGet.useQuery(
    { slug },
    { enabled: Boolean(slug), retry: false }
  );
  const store = trpc.storefront.publicConfig.useQuery(undefined, { retry: false });

  const notFound = !slug || query.isError;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FFFCF6] text-[#0C2A26]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E6EEEB] bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setLocation("/store")}
          className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#0F766E]"
        >
          <ArrowRight className="size-4" /> رجوع للمتجر
        </button>
        <span className="text-[14px] font-black">
          {store.data?.storeName ?? "المتجر"}
        </span>
        <button
          type="button"
          onClick={() => setLocation("/store/cart")}
          className="grid size-9 place-items-center rounded-xl border border-[#E6EEEB] bg-white"
          title="السلة"
        >
          <ShoppingCart className="size-4" />
        </button>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8">
        {query.isLoading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="size-7 animate-spin text-[#0F766E]" />
          </div>
        ) : notFound ? (
          <div className="grid place-items-center gap-3 py-24 text-center">
            <PackageOpen className="size-10 text-[#9aa39d]" />
            <h1 className="text-lg font-black">الفئة غير متاحة</h1>
            <p className="text-sm text-[#576B66]">
              الرابط غير صحيح أو أن الفئة لم تعد منشورة في هذا المتجر.
            </p>
            <button
              type="button"
              onClick={() => setLocation("/store")}
              className="rounded-full bg-[#0F766E] px-5 py-2.5 text-[13px] font-extrabold text-white"
            >
              تصفّح كل المنتجات
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black">{query.data?.category.name}</h1>
                <p className="mt-1 text-[13px] text-[#576B66]">
                  {query.data?.products.length ?? 0} منتج في هذه الفئة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLocation("/store")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EEEB] bg-white px-4 py-2 text-[12.5px] font-bold"
              >
                <Search className="size-3.5" /> كل المنتجات
              </button>
            </div>

            {query.data?.products.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-[#CDE3DE] bg-white py-20 text-center">
                <PackageOpen className="size-8 text-[#9aa39d]" />
                <p className="text-sm font-bold">لا منتجات في هذه الفئة بعد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {query.data?.products.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setLocation(`/p/${product.id}`)}
                    className="group overflow-hidden rounded-2xl border border-[#E6EEEB] bg-white text-right transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(12,42,38,0.45)]"
                  >
                    <span
                      className="block h-36 w-full bg-[#F3F7F6] bg-cover bg-center"
                      style={
                        product.images?.[0]?.url
                          ? { backgroundImage: `url(${product.images[0].url})` }
                          : undefined
                      }
                    />
                    <span className="block p-3">
                      <b className="block line-clamp-2 text-[13px]">{product.title}</b>
                      <span className="mt-1 block text-[12.5px] font-extrabold text-[#0F766E]">
                        {formatPrice(product.price, product.currency)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
