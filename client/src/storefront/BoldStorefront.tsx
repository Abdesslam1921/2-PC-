import { useMemo, useState } from "react";
import { StorefrontOffers } from "@/storefront/OfferSection";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, ShoppingCart, ArrowLeft, Search, UserRound } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { SectionShell, type SectionWrapperComponent } from "@/storefront/SectionShell";
import { SECTION_LABELS } from "@shared/storefront/sectionFields";
import { benefitRows, categoryTiles, footerData } from "@/storefront/sectionData";
import {
  FooterHelp,
  FooterSocial,
  FooterStoreLinks,
  SignatureFlourish,
  signatureStyle,
} from "@/storefront/FooterExtras";
import { storefrontAnchors } from "@/storefront/sectionIcons";
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

const WRAP = "mx-auto w-full max-w-[var(--sf-container-max,1240px)] px-4 sm:px-6";

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
  /** Real store categories (fail-closed on the server). */
  const categoriesQuery = trpc.categories.publicList.useQuery(undefined, {
    retry: false,
  });
  /** Active + fully available offers (fail-closed on the server). */
  const offersQuery = trpc.offers.publicList.useQuery(undefined, {
    retry: false,
  });
  const publicCategories = categoriesQuery.data ?? [];

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.collectionName) set.add(p.collectionName);
    return Array.from(set).slice(0, 4);
  }, [products]);

  const anchors = useMemo(() => storefrontAnchors(config), [config]);

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
      <div className="grid min-h-screen place-items-center bg-[var(--sf-color-surface-raised,#0C2A26)]">
        <Loader2 className="size-8 animate-spin text-[var(--sf-color-accent,#F5B13D)]" />
      </div>
    );
  }

  const sections = [...config.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--sf-color-background,#FFFFFF)] text-[var(--sf-color-text,#0C2A26)]">
      {sections.map(section => {
        const content = (() => {
          switch (section.type) {
          case "announcement":
            return (
              <div
                key={section.id}
                className="bg-[var(--sf-color-surface-raised,#0C2A26)] py-3 text-center text-[12.5px] font-extrabold text-[var(--sf-color-primary,#F5B13D)]"
              >
                <div>{str(section.settings.text)}</div>
                {str(section.settings.subtitle) ? (
                  <div className="mt-0.5 text-[11px] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80">
                    {str(section.settings.subtitle)}
                  </div>
                ) : null}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="sticky top-0 z-30 border-b-[3px] border-[var(--sf-color-primary,#F5B13D)] bg-[var(--sf-color-surface-raised,#0C2A26)] text-[var(--sf-color-text-inverted,#FFFFFF)]"
              >
                <div className={`${WRAP} flex h-[74px] items-center justify-between gap-3`}>
                  <span className="text-[22px] font-black tracking-[-0.01em]">
                    {storeName}
                  </span>
                  <nav className="hidden gap-5 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-90 sm:flex">
                    {collections.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          setActiveCollection(c => (c === name ? null : name))
                        }
                        className="hover:text-[var(--sf-color-primary,#F5B13D)]"
                      >
                        {name}
                      </button>
                    ))}
                  </nav>
                  <div className="flex items-center gap-2.5">
                    {section.settings.showSearch !== false ? (
                      <label className="hidden items-center gap-2 rounded-full border-2 border-white/30 px-3 py-1.5 text-[12px] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80 sm:flex">
                        <Search className="size-4" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="ابحث…"
                          className="w-24 bg-transparent text-[var(--sf-color-text-inverted,#FFFFFF)] outline-none placeholder:text-[var(--sf-color-text-inverted,#FFFFFF)]"
                        />
                      </label>
                    ) : null}
                    {section.settings.showAccount !== false ? (
                      <button
                        type="button"
                        className="hidden size-[46px] place-items-center rounded-2xl border-2 border-white/40 text-[var(--sf-color-text-inverted,#FFFFFF)] sm:grid"
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
                      className="rounded-full border-2 border-[var(--sf-color-border-strong,#0C2A26)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary,#F5B13D),var(--sf-color-primary,#F5B13D)))] px-4 py-2.5 text-[13px] font-black text-[var(--sf-color-primary-foreground,#FFFFFF)]"
                    >
                      تسوق الآن
                    </button>
                    {section.settings.showCart !== false ? (
                      <button
                        type="button"
                        onClick={() => setLocation("/store/cart")}
                        className="relative grid size-[46px] place-items-center rounded-2xl border-2 border-white/40 text-[var(--sf-color-text-inverted,#FFFFFF)]"
                        aria-label="السلة"
                      >
                        <ShoppingCart className="size-5" />
                        {itemCount > 0 && (
                          <span className="absolute -left-2 -top-2 grid min-w-[22px] place-items-center rounded-full bg-[#5EEAD4] px-1.5 text-[11px] font-black text-[var(--sf-color-text,#0C2A26)]">
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
                className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_82%_0%,rgba(94,234,212,0.22),transparent_55%),linear-gradient(150deg,var(--sf-color-surface-raised,#0C2A26),color-mix(in_srgb,var(--sf-color-surface-raised,#0C2A26)_72%,black))] text-[var(--sf-color-text-inverted,#FFFFFF)]"
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
                  <span className="inline-flex items-center gap-2 rounded-full bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#F5B13D)] px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-[var(--sf-color-primary-foreground,#0C2A26)]">
                    🔥 {str(section.settings.eyebrow, "عرض الأسبوع")}
                  </span>
                  <h1 className="mt-5 mb-4 max-w-[15ch] text-[38px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[76px]">
                    {str(section.settings.title, storeName)}
                  </h1>
                  <p className="mb-7 max-w-[46ch] text-[14px] font-medium leading-8 text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80 sm:text-[18px]">
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
                      className="inline-flex items-center gap-2.5 rounded-full border-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#F5B13D)] px-8 py-4 text-[16px] font-black text-[var(--sf-color-primary-foreground,#0C2A26)]"
                    >
                      {str(section.settings.ctaLabel, "تسوق المجموعة")}
                      <ArrowLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCollection(null)}
                      className="inline-flex items-center gap-2.5 rounded-full border-[3px] border-white/50 px-8 py-4 text-[16px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]"
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
                  <span className="text-[13px] font-black uppercase text-[var(--sf-color-primary,#F5B13D)]">
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
                          className="grid grid-cols-[44%_56%] overflow-hidden rounded-[var(--sf-radius-lg,28px)] border-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[var(--sf-color-surface,#FFFFFF)] shadow-[8px_8px_0_0_var(--sf-color-text,#0C2A26)] transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[12px_12px_0_0_var(--sf-color-text,#0C2A26)]"
                        >
                          <button
                            type="button"
                            onClick={() => setLocation(`/p/${product.id}`)}
                            className="relative min-h-[190px] bg-[linear-gradient(145deg,var(--sf-color-surface-muted,#DFF2EE),color-mix(in_srgb,var(--sf-color-primary,#F5B13D)_18%,var(--sf-color-surface-muted,#DFF2EE)))]"
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
                              <span className="absolute right-2.5 top-2.5 rounded-full border-2 border-[var(--sf-color-border-strong,#0C2A26)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#F5B13D)] px-3 py-1 text-[12px] font-black">
                                -{discount}%
                              </span>
                            ) : null}
                          </button>
                          <div className="flex flex-col gap-2 p-[18px]">
                            <h3 className="text-[20px] font-black leading-[1.35]">
                              {product.title}
                            </h3>
                            <span className="text-[12px] font-extrabold text-[var(--sf-color-text-muted,#576B66)]">
                              {product.collectionName ??
                                (soldOut ? "غير متوفر حاليًا" : "متوفر")}
                            </span>
                            <div className="flex items-baseline gap-2.5">
                              <b className="text-[30px] font-black">
                                {money(price)}
                              </b>
                              {compareAtPrice ? (
                                <span className="text-[14px] text-[var(--sf-color-text-muted,#576B66)] line-through">
                                  {money(compareAtPrice)}
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={soldOut}
                              onClick={() => add(product)}
                              className="mt-auto rounded-full border-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[var(--sf-color-surface-raised,#0C2A26)] px-4 py-3.5 text-[14px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)] transition hover:bg-none hover:bg-[var(--sf-color-primary-hover,#E0A22F)] hover:text-[var(--sf-color-primary-foreground,#0C2A26)] disabled:opacity-50"
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
                className="border-y-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#F5B13D)]"
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
                    className="justify-self-start rounded-full border-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[var(--sf-color-surface-raised,#0C2A26)] px-7 py-3.5 text-[15px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]"
                  >
                    {str(section.settings.ctaLabel, "اكتشف")}
                  </button>
                </div>
              </section>
            );
          case "benefits":
            return (
              <section key={section.id} className="bg-[var(--sf-color-surface-raised,#0C2A26)] text-[var(--sf-color-text-inverted,#FFFFFF)]">
                <div className={`${WRAP} py-7`}>
                  {str(section.settings.title) ? (
                    <h2 className="mb-4 text-center text-[22px] font-black text-[var(--sf-color-accent,#F5B13D)] sm:text-[26px]">
                      {str(section.settings.title)}
                    </h2>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {benefitRows(section, [
                      ["01", "توصيل 58 ولاية", "خلال 48–72 ساعة"],
                      ["02", "دفع عند الاستلام", "افحص قبل الدفع"],
                      ["03", "إرجاع 7 أيام", "استرجاع سهل"],
                      ["04", "دفع آمن", "بيانات محمية"],
                    ]).map(row => (
                      <div
                        key={row.id}
                        className="rounded-[18px] border-2 border-white/20 p-3.5"
                        style={row.bg ? { backgroundColor: row.bg } : undefined}
                      >
                        <b className="block text-[14px] font-black text-[var(--sf-color-accent,#F5B13D)]">
                          {row.title}
                        </b>
                        <span className="text-[12px] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80">{row.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          case "newsletter":
            return (
              <section key={section.id} className={`${WRAP} py-12 sm:py-16`}>
                <div className="grid gap-4 rounded-[var(--sf-radius-lg,28px)] bg-[var(--sf-color-surface-raised,#0C2A26)] p-7 text-[var(--sf-color-text-inverted,#FFFFFF)] sm:p-12">
                  <div>
                    <h2 className="text-[26px] font-black tracking-[-0.02em] sm:text-[40px]">
                      {str(section.settings.title, "لا تفوّت العروض.")}
                    </h2>
                    <p className="mt-2 text-[14px] font-medium text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80">
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
                      className="h-14 min-w-[220px] flex-1 rounded-full border-[3px] border-white bg-transparent px-5 text-[15px] font-semibold text-[var(--sf-color-text-inverted,#FFFFFF)] outline-none placeholder:text-[var(--sf-color-text-inverted,#FFFFFF)]"
                    />
                    <button
                      type="submit"
                      className="h-14 rounded-full border-[3px] border-[var(--sf-color-primary,#F5B13D)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary,#F5B13D),var(--sf-color-primary,#F5B13D)))] px-7 text-[15px] font-black text-[var(--sf-color-primary-foreground,#FFFFFF)] transition hover:bg-none hover:bg-[var(--sf-color-primary-hover,#E0A22F)]"
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
                className="mt-12 border-t-[3px] border-[var(--sf-color-primary,#F5B13D)] bg-[var(--sf-color-surface-raised,#0C2A26)] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-95"
              >
                <div className={`${WRAP} grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4`}>
                  {(() => {
                    const footer = footerData(section, anchors);
                    return (
                      <>
                        <div>
                          <span className="text-[22px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]">
                            {storeName}
                          </span>
                          <p className="mt-3 max-w-[34ch] text-[12.5px] leading-7">
                            {footer.about ||
                              "تسوّق بجرأة — توصيل لكل الولايات والدفع عند الاستلام."}
                          </p>
                        </div>
                        <div>
                          <h3 className="mb-3 text-[14px] font-black uppercase tracking-[0.06em] text-[var(--sf-color-accent,#F5B13D)]">
                            المتجر
                          </h3>
                          <FooterStoreLinks footer={footer} />
                        </div>
                        <div>
                          <h3 className="mb-3 text-[14px] font-black uppercase tracking-[0.06em] text-[var(--sf-color-accent,#F5B13D)]">
                            المساعدة
                          </h3>
                          <FooterHelp footer={footer} />
                        </div>
                        <div>
                          <h3 className="mb-3 text-[14px] font-black uppercase tracking-[0.06em] text-[var(--sf-color-accent,#F5B13D)]">
                            تابعنا
                          </h3>
                          <FooterSocial footer={footer} />
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div
                  className={`${WRAP} flex flex-wrap justify-between gap-2.5 border-t-2 border-white/15 py-4 text-[12px] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-70`}
                >
                  <span>© {new Date().getFullYear()} {storeName}</span>
                  <span>كل الحقوق محفوظة</span>
                </div>
              </footer>
            );
          case "categories":
            return (
              <section key={section.id} className={`${WRAP} py-12 sm:py-16`}>
                <h2 className="mb-5 text-[26px] font-black sm:text-[40px]">
                  {str(section.settings.title, "تسوق حسب الفئة")}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {categoriesQuery.isLoading ? (
                    <div className="col-span-2 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:col-span-4">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-[120px] animate-pulse rounded-[var(--sf-radius-lg,28px)] bg-[var(--sf-color-surface-muted,#DFF2EE)]"
                        />
                      ))}
                    </div>
                  ) : null}
                  {categoryTiles(
                    section,
                    publicCategories,
                    collections,
                    categoriesQuery.isLoading
                  ).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        item.slug
                          ? setLocation(`/store/category/${item.slug}`)
                          : setSearch(item.name)
                      }
                      className="flex min-h-[120px] items-end rounded-[var(--sf-radius-lg,28px)] border-[3px] border-[var(--sf-color-border-strong,#0C2A26)] bg-[image:var(--sf-brand-fill,linear-gradient(135deg,#0F766E,#0B5D57))] bg-cover bg-center p-4 text-right text-[16px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)] shadow-[8px_8px_0_0_#0C2A26]"
                      style={
                        item.imageUrl
                          ? { backgroundImage: `url(${item.imageUrl})` }
                          : item.bg
                            ? { background: item.bg }
                            : undefined
                      }
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </section>
            );
          case "signature":
            return (
              <section key={section.id} className={`${WRAP} py-10 text-center`}>
                {(() => {
                  const sig = signatureStyle(section);
                  return (
                    <>
                      {sig.showOrnament ? (
                        <SignatureFlourish className="mb-3" />
                      ) : null}
                      <div style={sig.style} className="text-[28px] font-black sm:text-[36px]">
                        {sig.text || storeName}
                      </div>
                      {sig.subtitle ? (
                        <div
                          style={sig.style}
                          className="mt-2 text-[14px] font-semibold text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-80"
                        >
                          {sig.subtitle}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>
            );
          case "offers":
            return (
              <StorefrontOffers
                key={section.id}
                section={section}
                offers={offersQuery.data ?? []}
                template="bold"
              />
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
