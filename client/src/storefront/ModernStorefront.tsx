import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  ShoppingCart,
  UserRound,
  Truck,
  Banknote,
  RotateCcw,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
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

export function ModernStorefront({
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
    return Array.from(set).slice(0, 4);
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
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
      <div className="grid min-h-screen place-items-center bg-[#FFFCF6]">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const sections = [...config.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const grid = (
    list: CatalogProduct[],
    limit?: number,
    cartFn: (p: CatalogProduct) => void = add
  ) => (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
      {list.slice(0, limit ?? list.length).map(product => {
        const { price, compareAtPrice } = getPrice(product);
        const discount =
          price && compareAtPrice && Number(compareAtPrice) > Number(price)
            ? Math.round((1 - Number(price) / Number(compareAtPrice)) * 100)
            : null;
        return (
          <article
            key={product.id}
            className="overflow-hidden rounded-[22px] border border-[#E6EEEB] bg-white shadow-[0_14px_34px_-22px_rgba(12,42,38,0.4)] transition hover:-translate-y-1"
          >
            <button
              type="button"
              onClick={() => setLocation(`/p/${product.id}`)}
              className="relative block h-44 w-full bg-[linear-gradient(135deg,#E7F4F1,#CFE9E3)]"
            >
              {product.images[0]?.url ? (
                <img
                  src={product.images[0].url}
                  alt={product.images[0].altText ?? product.title}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : null}
              {discount ? (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-[#FDF1DC] px-2.5 py-1 text-[11px] font-extrabold text-[#B45309]">
                  خصم {discount}%
                </span>
              ) : null}
            </button>
            <div className="p-3.5">
              <h3 className="mb-1 line-clamp-2 text-[14px] font-extrabold text-[#0C2A26]">
                {product.title}
              </h3>
              <p className="mb-2 line-clamp-1 text-[11.5px] text-[#576B66]">
                {product.collectionName ?? product.description}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-black text-[#0B5D57]">
                  {money(price)}
                </span>
                {compareAtPrice ? (
                  <span className="text-[12px] text-[#576B66] line-through">
                    {money(compareAtPrice)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => cartFn(product)}
                className="mt-3 w-full rounded-full border-[1.6px] border-[#0F766E] bg-white py-2.5 text-[13px] font-extrabold text-[#0F766E] transition hover:bg-[#0F766E] hover:text-white"
              >
                أضف إلى السلة
              </button>
            </div>
          </article>
        );
      })}
      {!list.length && (
        <div className="col-span-full rounded-2xl border border-dashed border-[#CDE3DE] bg-white/60 p-8 text-center text-sm text-[#576B66]">
          لا توجد منتجات منشورة بعد.
        </div>
      )}
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#FFFCF6] text-[#0C2A26]">
      {sections.map(section => {
        const content = (() => {
          switch (section.type) {
          case "announcement":
            return (
              <div
                key={section.id}
                className="bg-[linear-gradient(90deg,#0B5D57,#0F766E)] py-2.5 text-center text-[12.5px] font-bold text-white"
              >
                {str(section.settings.text)}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="sticky top-0 z-30 border-b border-[#E6EEEB] bg-[rgba(255,252,246,0.9)] backdrop-blur-xl"
              >
                <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-3 px-4">
                  <div className="flex items-center gap-2.5 text-[18px] font-black">
                    <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#14B8A6,#0B5D57)] font-black text-white">
                      {storeName.slice(0, 1)}
                    </span>
                    {storeName}
                  </div>
                  <label className="hidden min-w-[220px] items-center gap-2 rounded-full border border-[#E6EEEB] bg-white px-3.5 py-2.5 text-[13px] text-[#576B66] sm:flex">
                    <Search className="size-4" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="ابحث عن منتج…"
                      className="w-full bg-transparent outline-none"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLocation("/store/checkout")}
                      className="relative grid size-10 place-items-center rounded-xl border border-[#E6EEEB] bg-white text-[#2F433F]"
                      aria-label="السلة"
                    >
                      <ShoppingCart className="size-[18px]" />
                      {itemCount > 0 && (
                        <span className="absolute -left-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#0F766E] px-1 text-[10px] font-extrabold text-white">
                          {itemCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="hidden size-10 place-items-center rounded-xl border border-[#E6EEEB] bg-white text-[#2F433F] sm:grid"
                      aria-label="الحساب"
                    >
                      <UserRound className="size-[18px]" />
                    </button>
                  </div>
                </div>
              </header>
            );
          case "hero":
            return (
              <section
                key={section.id}
                className="relative grid min-h-[440px] items-end overflow-hidden bg-[radial-gradient(120%_100%_at_80%_0%,rgba(94,234,212,0.55),transparent_60%),linear-gradient(135deg,#0B5D57,#0F766E_55%,#12907F)]"
              >
                {typeof section.settings.imageUrl === "string" &&
                section.settings.imageUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${section.settings.imageUrl})`,
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,23,26,0.55),transparent_55%)]" />
                <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-12 text-white">
                  {str(section.settings.eyebrow) ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-[12px] font-extrabold">
                      ✦ {str(section.settings.eyebrow)}
                    </span>
                  ) : null}
                  <h1 className="mt-4 mb-3 max-w-[16ch] text-[34px] font-black leading-[1.25] sm:text-[52px]">
                    {str(section.settings.title, storeName)}
                  </h1>
                  <p className="mb-5 max-w-[46ch] text-[14px] leading-8 text-[#E7F4F1] sm:text-[17px]">
                    {str(section.settings.subtitle)}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("featured")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-extrabold text-[#0B5D57]"
                    >
                      {str(section.settings.ctaLabel, "تسوق الآن")}
                      <ArrowLeft className="size-4" />
                    </button>
                  </div>
                </div>
              </section>
            );
          case "categories":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-[1200px] px-4 py-14"
              >
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[26px] font-black sm:text-[30px]">
                      {str(section.settings.title, "تسوق حسب الفئة")}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[#576B66]">
                      {str(section.settings.subtitle)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(collections.length
                    ? collections
                    : ["ملابس", "عناية", "إكسسوارات", "إلكترونيات"]
                  ).map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setSearch(name === "ملابس" && !collections.length ? "" : name)
                      }
                      className="flex min-h-[120px] items-end rounded-[22px] p-4 text-right font-black text-white"
                      style={{
                        background:
                          [
                            "linear-gradient(135deg,#0F766E,#0B5D57)",
                            "linear-gradient(135deg,#B45309,#7C2D12)",
                            "linear-gradient(135deg,#15803D,#14532D)",
                            "linear-gradient(135deg,#334155,#0F172A)",
                          ][i % 4],
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </section>
            );
          case "featured_products":
          case "product_grid":
            return (
              <section
                key={section.id}
                id="featured"
                className="mx-auto max-w-[1200px] px-4 py-6"
              >
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[26px] font-black sm:text-[30px]">
                      {str(
                        section.settings.title,
                        section.type === "product_grid" ? "كل المنتجات" : "منتجات مميزة"
                      )}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[#576B66]">
                      {str(section.settings.subtitle)}
                    </p>
                  </div>
                </div>
                {grid(
                  visible,
                  typeof section.settings.limit === "number"
                    ? section.settings.limit
                    : undefined
                )}
              </section>
            );
          case "promo":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-[1200px] px-4 py-6"
              >
                <div className="grid items-center gap-5 rounded-[22px] bg-[linear-gradient(120deg,#0B5D57,#0F766E_60%,#12907F)] p-8 text-white sm:grid-cols-[1.4fr_auto] sm:p-11">
                  <div>
                    <h2 className="text-[24px] font-black sm:text-[32px]">
                      {str(section.settings.title)}
                    </h2>
                    <p className="mt-2 text-[14px] leading-8 text-[#DFF0EC]">
                      {str(section.settings.body)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("featured")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="rounded-full bg-white px-6 py-3.5 text-[14px] font-extrabold text-[#0B5D57]"
                  >
                    {str(section.settings.ctaLabel, "اكتشف")}
                  </button>
                </div>
              </section>
            );
          case "benefits":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-[1200px] px-4 py-8"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { icon: Truck, title: "توصيل سريع", text: "لجميع الولايات." },
                    { icon: Banknote, title: "دفع عند الاستلام", text: "افحص قبل الدفع." },
                    { icon: RotateCcw, title: "إرجاع 7 أيام", text: "استرجاع سهل." },
                    { icon: ShieldCheck, title: "دفع آمن", text: "بياناتك محمية." },
                  ].map(({ icon: Icon, title, text }) => (
                    <div
                      key={title}
                      className="flex items-start gap-3 rounded-2xl border border-[#E6EEEB] bg-white p-4"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3F7F6] text-[#0F766E]">
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <b className="block text-[13.5px]">{title}</b>
                        <span className="text-[11.5px] text-[#576B66]">{text}</span>
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
                className="mx-auto max-w-[1200px] px-4 py-8"
              >
                <div className="grid items-center gap-4 rounded-[22px] border border-[#E6EEEB] bg-[#F3F7F6] p-7 sm:grid-cols-[1fr_auto] sm:p-9">
                  <div>
                    <h2 className="text-[22px] font-black">
                      {str(section.settings.title, "انضم إلى نشرتنا")}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[#576B66]">
                      {str(section.settings.subtitle)}
                    </p>
                  </div>
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={e => e.preventDefault()}
                  >
                    <input
                      type="email"
                      placeholder="بريدك الإلكتروني"
                      className="h-12 min-w-[200px] flex-1 rounded-full border border-[#E6EEEB] bg-white px-4 text-[14px] outline-none"
                    />
                    <button
                      type="submit"
                      className="h-12 rounded-full bg-[linear-gradient(135deg,#14B8A6,#0B5D57)] px-6 text-[14px] font-extrabold text-white"
                    >
                      {str(section.settings.ctaLabel, "اشترك")}
                    </button>
                  </form>
                </div>
              </section>
            );
          case "footer":
            return (
              <footer key={section.id} className="mt-14 bg-[#0C2A26] text-[#CFE0DC]">
                <div className="mx-auto grid max-w-[1200px] gap-7 px-4 py-11 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="flex items-center gap-2.5 text-[18px] font-black text-white">
                      <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#14B8A6,#0B5D57)] text-white">
                        {storeName.slice(0, 1)}
                      </span>
                      {storeName}
                    </div>
                    <p className="mt-3 max-w-[34ch] text-[12.5px] leading-7">
                      تسوق بثقة — توصيل لكل الولايات والدفع عند الاستلام.
                    </p>
                  </div>
                  {[
                    { h: "المتجر", links: ["المنتجات", "الفئات", "العروض"] },
                    { h: "المساعدة", links: ["تتبع الطلب", "سياسة الإرجاع", "اتصل بنا"] },
                    { h: "تابعنا", links: ["فيسبوك", "إنستغرام", "واتساب"] },
                  ].map(col => (
                    <div key={col.h}>
                      <h3 className="mb-3 text-[15px] font-black text-white">
                        {col.h}
                      </h3>
                      {col.links.map(l => (
                        <span key={l} className="mb-2 block text-[13px]">
                          {l}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-2.5 border-t border-white/10 px-4 py-4 text-[12px] text-[#9FB8B3]">
                  <span>© {new Date().getFullYear()} {storeName}</span>
                  <span>جميع الحقوق محفوظة</span>
                </div>
              </footer>
            );
          case "testimonials":
            return null;
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
