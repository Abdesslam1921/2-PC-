import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, ShoppingCart, ArrowLeft, Search, UserRound } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { SectionShell, type SectionWrapperComponent } from "@/storefront/SectionShell";
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

const WRAP = "mx-auto w-full max-w-[1240px] px-4 sm:px-6";

export function BoldStorefront({
  config,
  storeName,
  SectionWrapper = SectionShell,
  highlightSectionId,
  onSelectSection,
}: {
  config: StorefrontConfig;
  storeName: string;
  SectionWrapper?: SectionWrapperComponent;
  highlightSectionId?: string | null;
  onSelectSection?: (id: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { addItem, itemCount } = useCart();
  const productsQuery = trpc.products.publicList.useQuery();
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const products = (productsQuery.data ?? []) as unknown as CatalogProduct[];
  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.collectionName) set.add(p.collectionName);
    return Array.from(set).slice(0, 4);
  }, [products]);

  const visible = useMemo(() => {
    let list = activeCollection
      ? products.filter(p => p.collectionName === activeCollection)
      : products;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p => p.title.toLowerCase().includes(q));
    return list;
  }, [products, activeCollection, search]);

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
      <div className="grid min-h-screen place-items-center bg-[#0C2A26]">
        <Loader2 className="size-8 animate-spin text-[#5EEAD4]" />
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
                className="bg-[#0C2A26] py-3 text-center text-[12.5px] font-extrabold text-[#F5B13D]"
              >
                {str(section.settings.text)}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="sticky top-0 z-30 border-b-[3px] border-[#F5B13D] bg-[#0C2A26] text-white"
              >
                <div className={`${WRAP} flex h-[74px] items-center justify-between gap-3`}>
                  <span className="text-[22px] font-black tracking-[-0.01em]">
                    {storeName}
                  </span>
                  <nav className="hidden gap-5 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#D7E6E2] sm:flex">
                    {collections.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          setActiveCollection(c => (c === name ? null : name))
                        }
                        className="hover:text-[#F5B13D]"
                      >
                        {name}
                      </button>
                    ))}
                  </nav>
                  <div className="flex items-center gap-2.5">
                    {section.settings.showSearch !== false ? (
                      <label className="hidden items-center gap-2 rounded-full border-2 border-white/30 px-3 py-1.5 text-[12px] text-[#CFE6E1] sm:flex">
                        <Search className="size-4" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="ابحث…"
                          className="w-24 bg-transparent text-white outline-none placeholder:text-[#9FC0BA]"
                        />
                      </label>
                    ) : null}
                    {section.settings.showAccount !== false ? (
                      <button
                        type="button"
                        className="hidden size-[46px] place-items-center rounded-2xl border-2 border-white/40 text-white sm:grid"
                        aria-label="الحساب"
                      >
                        <UserRound className="size-5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("bold-grid")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="rounded-full border-2 border-[#0C2A26] bg-[#F5B13D] px-4 py-2.5 text-[13px] font-black text-[#0C2A26]"
                    >
                      تسوق الآن
                    </button>
                    {section.settings.showCart !== false ? (
                      <button
                        type="button"
                        onClick={() => setLocation("/store/cart")}
                        className="relative grid size-[46px] place-items-center rounded-2xl border-2 border-white/40 text-white"
                        aria-label="السلة"
                      >
                        <ShoppingCart className="size-5" />
                        {itemCount > 0 && (
                          <span className="absolute -left-2 -top-2 grid min-w-[22px] place-items-center rounded-full bg-[#5EEAD4] px-1.5 text-[11px] font-black text-[#0C2A26]">
                            {itemCount}
                          </span>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </header>
            );
          case "hero":
            return (
              <section
                key={section.id}
                className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_82%_0%,rgba(94,234,212,0.22),transparent_55%),linear-gradient(150deg,#0C2A26,#0B1C19_60%,#050D0C)] text-white"
              >
                {typeof section.settings.imageUrl === "string" &&
                section.settings.imageUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-40"
                    style={{
                      backgroundImage: `url(${section.settings.imageUrl})`,
                    }}
                  />
                ) : null}
                <div className={`relative ${WRAP} py-16 sm:py-28`}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#F5B13D] px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#0C2A26]">
                    🔥 {str(section.settings.eyebrow, "عرض الأسبوع")}
                  </span>
                  <h1 className="mt-5 mb-4 max-w-[15ch] text-[38px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[76px]">
                    {str(section.settings.title, storeName)}
                  </h1>
                  <p className="mb-7 max-w-[46ch] text-[14px] font-medium leading-8 text-[#CFE6E1] sm:text-[18px]">
                    {str(section.settings.subtitle)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("bold-grid")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="inline-flex items-center gap-2.5 rounded-full border-[3px] border-[#0C2A26] bg-[#F5B13D] px-8 py-4 text-[16px] font-black text-[#0C2A26]"
                    >
                      {str(section.settings.ctaLabel, "تسوق المجموعة")}
                      <ArrowLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCollection(null)}
                      className="inline-flex items-center gap-2.5 rounded-full border-[3px] border-white/50 px-8 py-4 text-[16px] font-black text-white"
                    >
                      شاهد العروض
                    </button>
                  </div>
                </div>
              </section>
            );
          case "featured_products":
          case "product_grid":
            return (
              <section
                key={section.id}
                id="bold-grid"
                className={`${WRAP} py-12 sm:py-16`}
              >
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-[26px] font-black tracking-[-0.02em] sm:text-[40px]">
                    {str(section.settings.title, "الأكثر مبيعًا")}
                  </h2>
                  <span className="text-[13px] font-black uppercase text-[#0F766E]">
                    {visible.length} منتجًا
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visible
                    .slice(
                      0,
                      typeof section.settings.limit === "number"
                        ? section.settings.limit
                        : visible.length
                    )
                    .map(product => {
                      const { price, compareAtPrice } = getPrice(product);
                      const discount =
                        price &&
                        compareAtPrice &&
                        Number(compareAtPrice) > Number(price)
                          ? Math.round(
                              (1 - Number(price) / Number(compareAtPrice)) * 100
                            )
                          : null;
                      const soldOut =
                        product.trackInventory &&
                        !product.continueSelling &&
                        product.inventory <= 0;
                      return (
                        <article
                          key={product.id}
                          className="grid grid-cols-[44%_56%] overflow-hidden rounded-[28px] border-[3px] border-[#0C2A26] bg-white shadow-[8px_8px_0_0_#0C2A26] transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[12px_12px_0_0_#0C2A26]"
                        >
                          <button
                            type="button"
                            onClick={() => setLocation(`/p/${product.id}`)}
                            className="relative min-h-[190px] bg-[linear-gradient(145deg,#DFF2EE,#BFE6DE)]"
                          >
                            {product.images[0]?.url ? (
                              <img
                                src={product.images[0].url}
                                alt={product.images[0].altText ?? product.title}
                                loading="lazy"
                                className="absolute inset-0 size-full object-cover"
                              />
                            ) : null}
                            {discount ? (
                              <span className="absolute right-2.5 top-2.5 rounded-full border-2 border-[#0C2A26] bg-[#F5B13D] px-3 py-1 text-[12px] font-black">
                                -{discount}%
                              </span>
                            ) : null}
                          </button>
                          <div className="flex flex-col gap-2 p-[18px]">
                            <h3 className="text-[20px] font-black leading-[1.35]">
                              {product.title}
                            </h3>
                            <span className="text-[12px] font-extrabold text-[#576B66]">
                              {product.collectionName ??
                                (soldOut ? "غير متوفر حاليًا" : "متوفر")}
                            </span>
                            <div className="flex items-baseline gap-2.5">
                              <b className="text-[30px] font-black">
                                {money(price)}
                              </b>
                              {compareAtPrice ? (
                                <span className="text-[14px] text-[#576B66] line-through">
                                  {money(compareAtPrice)}
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={soldOut}
                              onClick={() => add(product)}
                              className="mt-auto rounded-full border-[3px] border-[#0C2A26] bg-[#0C2A26] px-4 py-3.5 text-[14px] font-black text-white transition hover:bg-[#0F766E] disabled:opacity-50"
                            >
                              {soldOut ? "نفد المخزون" : "أضف للسلة فورًا"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </section>
            );
          case "promo":
            return (
              <section
                key={section.id}
                className="border-y-[3px] border-[#0C2A26] bg-[#F5B13D]"
              >
                <div
                  className={`${WRAP} grid gap-4 py-10 sm:grid-cols-[1.5fr_auto] sm:items-center`}
                >
                  <div>
                    <h2 className="text-[28px] font-black leading-[1.05] tracking-[-0.025em] sm:text-[56px]">
                      {str(section.settings.title)}
                    </h2>
                    <p className="mt-2 max-w-[52ch] text-[15px] font-bold">
                      {str(section.settings.body)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("bold-grid")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="justify-self-start rounded-full border-[3px] border-[#0C2A26] bg-[#0C2A26] px-7 py-3.5 text-[15px] font-black text-white"
                  >
                    {str(section.settings.ctaLabel, "اكتشف")}
                  </button>
                </div>
              </section>
            );
          case "benefits":
            return (
              <section key={section.id} className="bg-[#0C2A26] text-white">
                <div className={`${WRAP} py-7`}>
                  {str(section.settings.title) ? (
                    <h2 className="mb-4 text-center text-[22px] font-black text-[#F5B13D] sm:text-[26px]">
                      {str(section.settings.title)}
                    </h2>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["توصيل 58 ولاية", "خلال 48–72 ساعة"],
                    ["دفع عند الاستلام", "افحص قبل الدفع"],
                    ["إرجاع 7 أيام", "استرجاع سهل"],
                    ["دفع آمن", "بيانات محمية"],
                  ].map(([title, text]) => (
                    <div
                      key={title}
                      className="rounded-[18px] border-2 border-white/20 p-3.5"
                    >
                      <b className="block text-[14px] font-black text-[#F5B13D]">
                        {title}
                      </b>
                      <span className="text-[12px] text-[#CFE6E1]">{text}</span>
                    </div>
                  ))}
                  </div>
                </div>
              </section>
            );
          case "newsletter":
            return (
              <section key={section.id} className={`${WRAP} py-12 sm:py-16`}>
                <div className="grid gap-4 rounded-[28px] bg-[#0C2A26] p-7 text-white sm:p-12">
                  <div>
                    <h2 className="text-[26px] font-black tracking-[-0.02em] sm:text-[40px]">
                      {str(section.settings.title, "لا تفوّت العروض.")}
                    </h2>
                    <p className="mt-2 text-[14px] font-medium text-[#CFE6E1]">
                      {str(section.settings.subtitle)}
                    </p>
                  </div>
                  <form
                    className="flex flex-wrap gap-2.5"
                    onSubmit={e => e.preventDefault()}
                  >
                    <input
                      type="email"
                      placeholder="بريدك الإلكتروني"
                      className="h-14 min-w-[220px] flex-1 rounded-full border-[3px] border-white bg-transparent px-5 text-[15px] font-semibold text-white outline-none placeholder:text-[#9FC0BA]"
                    />
                    <button
                      type="submit"
                      className="h-14 rounded-full border-[3px] border-[#F5B13D] bg-[#F5B13D] px-7 text-[15px] font-black text-[#0C2A26]"
                    >
                      {str(section.settings.ctaLabel, "اشترك")}
                    </button>
                  </form>
                </div>
              </section>
            );
          case "footer":
            return (
              <footer
                key={section.id}
                className="mt-12 border-t-[3px] border-[#F5B13D] bg-[#0C2A26] text-[#CFE6E1]"
              >
                <div className={`${WRAP} grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4`}>
                  <div>
                    <span className="text-[22px] font-black text-white">
                      {storeName}
                    </span>
                    <p className="mt-3 max-w-[34ch] text-[12.5px] leading-7">
                      تسوّق بجرأة — توصيل لكل الولايات والدفع عند الاستلام.
                    </p>
                  </div>
                  {[
                    { h: "المتجر", links: ["جديد", "عروض", "الفئات"] },
                    { h: "المساعدة", links: ["تتبع الطلب", "الإرجاع", "اتصل بنا"] },
                    { h: "تابعنا", links: ["فيسبوك", "إنستغرام", "واتساب"] },
                  ].map(col => (
                    <div key={col.h}>
                      <h3 className="mb-3 text-[14px] font-black uppercase tracking-[0.06em] text-[#F5B13D]">
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
                <div
                  className={`${WRAP} flex flex-wrap justify-between gap-2.5 border-t-2 border-white/15 py-4 text-[12px] text-[#9FC0BA]`}
                >
                  <span>© {new Date().getFullYear()} {storeName}</span>
                  <span>كل الحقوق محفوظة</span>
                </div>
              </footer>
            );
          default:
            return null;
          }
        })();
        if (!content) return null;
        return (
          <SectionWrapper
            key={section.id}
            id={section.id}
            label={SECTION_LABELS[section.type]}
            settings={section.settings}
            highlight={highlightSectionId === section.id}
            onSelect={onSelectSection}
          >
            {content}
          </SectionWrapper>
        );
      })}
    </div>
  );
}
