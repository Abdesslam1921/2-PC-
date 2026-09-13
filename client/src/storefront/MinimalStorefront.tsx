import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { SectionShell } from "@/storefront/SectionShell";
import { SECTION_LABELS } from "@shared/storefront/sectionFields";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

type CatalogProduct = {
  id: number;
  title: string;
  description: string;
  productKind: "physical" | "digital";
  currency: string;
  collectionName: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventory: number;
  trackInventory: boolean;
  continueSelling: boolean;
  images: Array<{ id: number; url: string; altText: string | null }>;
  variants: Array<{
    id: number;
    price: string | null;
    compareAtPrice: string | null;
    stock: number;
    available: boolean;
  }>;
};

const money = (value: string | null | undefined) =>
  value
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} دج`
    : "السعر غير محدد";

function getPrice(product: CatalogProduct) {
  const variant =
    product.variants.find(item => item.price !== null) ?? product.variants[0];
  return {
    variant,
    price: product.price ?? variant?.price ?? null,
    compareAtPrice: product.compareAtPrice ?? variant?.compareAtPrice ?? null,
  };
}

const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const LABEL = "text-[11px] uppercase tracking-[0.22em] text-[#576B66]";
const WRAP = "mx-auto w-full max-w-[1080px] px-5 sm:px-8";

export function MinimalStorefront({
  config,
  storeName,
  highlightSectionId,
  onSelectSection,
}: {
  config: StorefrontConfig;
  storeName: string;
  highlightSectionId?: string | null;
  onSelectSection?: (id: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { addItem, itemCount } = useCart();
  const productsQuery = trpc.products.publicList.useQuery();
  const [search, setSearch] = useState("");

  const products = (productsQuery.data ?? []) as unknown as CatalogProduct[];
  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.collectionName) set.add(p.collectionName);
    return Array.from(set).slice(0, 3);
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        (p.collectionName ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const add = (product: CatalogProduct) => {
    const { variant, price, compareAtPrice } = getPrice(product);
    if (!price) return;
    addItem({
      productId: product.id,
      productKind: product.productKind,
      variantId: variant?.id,
      title: product.title,
      imageUrl: product.images[0]?.url,
      price,
      compareAtPrice: compareAtPrice ?? undefined,
      maxQuantity:
        product.trackInventory && !product.continueSelling
          ? (variant?.stock ?? product.inventory)
          : undefined,
    });
    toast.success(`أُضيف «${product.title}» إلى السلة.`);
  };

  if (productsQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const sections = [...config.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#0C2A26]">
      {sections.map(section => {
        const content = (() => {
          switch (section.type) {
          case "announcement":
            return (
              <div
                key={section.id}
                className="border-b border-[#E7E9E8] py-3.5 text-center text-[11.5px] uppercase tracking-[0.18em] text-[#576B66]"
              >
                {str(section.settings.text)}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="border-b border-[#E7E9E8] bg-white"
              >
                <div className={`${WRAP} flex h-[66px] items-center justify-between gap-4`}>
                  <span className="text-[16px] font-bold tracking-[0.02em]">
                    {storeName}
                  </span>
                  <nav className="hidden gap-[30px] text-[12px] uppercase tracking-[0.16em] text-[#576B66] sm:flex">
                    <a href="#grid" className="hover:text-[#0C2A26]">
                      المتجر
                    </a>
                    {collections[0] ? (
                      <button
                        type="button"
                        onClick={() => setSearch(collections[0])}
                        className="hover:text-[#0C2A26]"
                      >
                        {collections[0]}
                      </button>
                    ) : null}
                    <a href="#about" className="hover:text-[#0C2A26]">
                      عن العلامة
                    </a>
                  </nav>
                  {section.settings.showCart !== false ? (
                    <button
                      type="button"
                      onClick={() => setLocation("/store/cart")}
                      className="border-b border-transparent text-[12px] tracking-[0.1em] transition hover:border-[#0F766E] hover:text-[#0F766E]"
                    >
                      السلة ({itemCount})
                    </button>
                  ) : null}
                </div>
              </header>
            );
          case "hero":
            return (
              <section key={section.id} className={WRAP}>
                <div className="py-16 sm:py-28">
                  <span className={`block ${LABEL} mb-6`}>
                    {str(section.settings.eyebrow)}
                  </span>
                  <h1 className="max-w-[20ch] text-[30px] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[52px]">
                    {str(section.settings.title, storeName)}
                  </h1>
                  <p className="mt-6 max-w-[52ch] text-[14px] font-light leading-9 text-[#576B66] sm:text-[16px]">
                    {str(section.settings.subtitle)}
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-7">
                    <a
                      href="#grid"
                      className="border-b border-[#0C2A26] pb-1 text-[13px] uppercase tracking-[0.12em]"
                    >
                      {str(section.settings.ctaLabel, "تسوق")}
                    </a>
                  </div>
                </div>
              </section>
            );
          case "featured_products":
          case "product_grid":
            return (
              <section
                key={section.id}
                id="grid"
                className={`${WRAP} border-t border-[#E7E9E8] py-20`}
              >
                <div className="mb-11 flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="text-[22px] font-semibold tracking-[-0.01em] sm:text-[26px]">
                    {str(section.settings.title, "المجموعة")}
                  </h2>
                  {str(section.settings.subtitle) ? (
                    <span className={LABEL}>{str(section.settings.subtitle)}</span>
                  ) : (
                    <span className={LABEL}>{visible.length} منتجًا</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-[22px] gap-y-[34px] sm:grid-cols-3 lg:grid-cols-4">
                  {visible
                    .slice(
                      0,
                      typeof section.settings.limit === "number"
                        ? section.settings.limit
                        : visible.length
                    )
                    .map(product => {
                      const { price, compareAtPrice } = getPrice(product);
                      return (
                        <div key={product.id} className="group">
                          <button
                            type="button"
                            onClick={() => setLocation(`/p/${product.id}`)}
                            className="block aspect-[4/5] w-full overflow-hidden rounded-[3px] bg-[#F4F5F4] transition group-hover:opacity-80"
                          >
                            {product.images[0]?.url ? (
                              <img
                                src={product.images[0].url}
                                alt={product.images[0].altText ?? product.title}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            ) : null}
                          </button>
                          <h3 className="mt-4 text-[14px] font-medium">
                            {product.title}
                          </h3>
                          <div className="text-[13px] text-[#576B66]">
                            <b className="font-semibold text-[#0C2A26]">
                              {money(price)}
                            </b>
                            {compareAtPrice ? (
                              <span className="ms-2 line-through">
                                {money(compareAtPrice)}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => add(product)}
                            className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[#0F766E]"
                          >
                            أضف إلى السلة
                          </button>
                        </div>
                      );
                    })}
                  {!visible.length && (
                    <p className="col-span-full text-sm text-[#576B66]">
                      لا توجد منتجات منشورة بعد.
                    </p>
                  )}
                </div>
              </section>
            );
          case "promo":
            return (
              <section key={section.id} className={WRAP}>
                <div className="border border-[#E7E9E8] px-8 py-14 text-center sm:px-16">
                  <span className={LABEL}>لفترة محدودة</span>
                  <h2 className="mt-4 text-[22px] font-semibold sm:text-[28px]">
                    {str(section.settings.title)}
                  </h2>
                  <p className="mx-auto mt-4 mb-7 max-w-[48ch] text-[14px] font-light text-[#576B66]">
                    {str(section.settings.body)}
                  </p>
                  <a
                    href="#grid"
                    className="border-b border-[#0C2A26] pb-1 text-[13px] uppercase tracking-[0.12em]"
                  >
                    {str(section.settings.ctaLabel, "اكتشف")}
                  </a>
                </div>
              </section>
            );
          case "benefits":
            return (
              <section
                key={section.id}
                id="about"
                className={`${WRAP} mt-20 border-t border-[#E7E9E8] py-16`}
              >
                <h2 className="mb-8 text-[22px] font-semibold sm:text-[26px]">
                  لماذا نحن
                </h2>
                <div className="grid sm:grid-cols-2 sm:gap-x-12">
                  {[
                    ["01", "توصيل سريع", "لجميع الولايات خلال 48–72 ساعة."],
                    ["02", "دفع عند الاستلام", "افحص طلبك قبل الدفع."],
                    ["03", "إرجاع خلال 7 أيام", "استرجاع بسيط بلا تعقيد."],
                    ["04", "دفع آمن", "بياناتك محمية دائمًا."],
                  ].map(([num, title, text]) => (
                    <div
                      key={num}
                      className="flex items-baseline gap-3.5 border-b border-[#E7E9E8] py-5"
                    >
                      <span className="text-[11px] tracking-[0.16em] text-[#576B66]">
                        {num}
                      </span>
                      <span>
                        <b className="block text-[13.5px] font-semibold">{title}</b>
                        <span className="text-[12.5px] font-light text-[#576B66]">
                          {text}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "newsletter":
            return (
              <section
                key={section.id}
                className={`${WRAP} py-20 text-center`}
              >
                <h2 className="text-[22px] font-semibold sm:text-[26px]">
                  {str(section.settings.title, "انضم إلى نشرتنا")}
                </h2>
                <p className="mt-3 mb-8 text-[13.5px] font-light text-[#576B66]">
                  {str(section.settings.subtitle)}
                </p>
                <form
                  className="mx-auto flex max-w-[440px] border-b border-[#0C2A26]"
                  onSubmit={e => e.preventDefault()}
                >
                  <input
                    type="email"
                    placeholder="بريدك الإلكتروني"
                    className="flex-1 bg-transparent px-1 py-3 text-[13.5px] outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-3 text-[12px] uppercase tracking-[0.14em] text-[#0F766E]"
                  >
                    {str(section.settings.ctaLabel, "اشترك")}
                  </button>
                </form>
              </section>
            );
          case "footer":
            return (
              <footer
                key={section.id}
                className="border-t border-[#E7E9E8] py-8"
              >
                <div
                  className={`${WRAP} flex flex-wrap items-center justify-between gap-3.5 text-[12px] text-[#576B66]`}
                >
                  <span>© {new Date().getFullYear()} {storeName}</span>
                  <div className="flex flex-wrap gap-x-6 gap-y-2.5 tracking-[0.06em]">
                    <a href="#grid" className="hover:text-[#0C2A26]">
                      المنتجات
                    </a>
                    <span>الإرجاع</span>
                    <span>اتصل بنا</span>
                  </div>
                </div>
              </footer>
            );
          default:
            return null;
          }
        })();
        if (!content) return null;
        return (
          <SectionShell
            key={section.id}
            id={section.id}
            label={SECTION_LABELS[section.type]}
            settings={section.settings}
            highlight={highlightSectionId === section.id}
            onSelect={onSelectSection}
          >
            {content}
          </SectionShell>
        );
      })}
    </div>
  );
}
