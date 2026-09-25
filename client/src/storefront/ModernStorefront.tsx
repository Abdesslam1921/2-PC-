import { useMemo, useState } from "react";
import { StorefrontOffers } from "@/storefront/OfferSection";
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
import { sectionIcon, storefrontAnchors } from "@/storefront/sectionIcons";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

const DEFAULT_BENEFIT_ICONS = [Truck, Banknote, RotateCcw, ShieldCheck];

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
      <div className="grid min-h-screen place-items-center bg-[var(--sf-color-background,#FFFCF6)]">
        <Loader2 className="size-8 animate-spin text-[var(--sf-color-primary,#0F766E)]" />
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
            className="overflow-hidden rounded-[var(--sf-radius-lg,22px)] border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] shadow-[0_14px_34px_-22px_rgba(12,42,38,0.4)] transition hover:-translate-y-1"
          >
            <button
              type="button"
              onClick={() => setLocation(`/p/${product.id}`)}
              className="relative block h-44 w-full bg-[linear-gradient(135deg,var(--sf-color-surface-muted,#F3F7F6),color-mix(in_srgb,var(--sf-color-primary,#0F766E)_14%,var(--sf-color-surface-muted,#F3F7F6)))]"
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
                <span className="absolute right-2.5 top-2.5 rounded-full bg-[color-mix(in_srgb,var(--sf-color-accent,#B45309)_16%,white)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--sf-color-accent,#B45309)]">
                  خصم {discount}%
                </span>
              ) : null}
            </button>
            <div className="p-3.5">
              <h3 className="mb-1 line-clamp-2 text-[14px] font-extrabold text-[var(--sf-color-text,#0C2A26)]">
                {product.title}
              </h3>
              <p className="mb-2 line-clamp-1 text-[11.5px] text-[var(--sf-color-text-muted,#576B66)]">
                {product.collectionName ?? product.description}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-black text-[var(--sf-color-primary-hover,#0B5D57)]">
                  {money(price)}
                </span>
                {compareAtPrice ? (
                  <span className="text-[12px] text-[var(--sf-color-text-muted,#576B66)] line-through">
                    {money(compareAtPrice)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => cartFn(product)}
                className="mt-3 w-full rounded-full border-[1.6px] border-[var(--sf-color-primary,#0F766E)] bg-[var(--sf-color-surface,#FFFFFF)] py-2.5 text-[13px] font-extrabold text-[var(--sf-color-primary,#0F766E)] transition hover:border-[var(--sf-color-primary-hover,#0B5D57)] hover:bg-[var(--sf-color-primary-hover,#0B5D57)] hover:text-[var(--sf-color-primary-foreground,#FFFFFF)]"
              >
                أضف إلى السلة
              </button>
            </div>
          </article>
        );
      })}
      {!list.length && (
        <div className="col-span-full rounded-2xl border border-dashed border-[var(--sf-color-border,#CDE3DE)] bg-[var(--sf-color-surface,#FFFFFF)] p-8 text-center text-sm text-[var(--sf-color-text-muted,#576B66)]">
          لا توجد منتجات منشورة بعد.
        </div>
      )}
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--sf-color-background,#FFFCF6)] text-[var(--sf-color-text,#0C2A26)]">
      {sections.map(section => {
        const content = (() => {
          switch (section.type) {
          case "announcement":
            return (
              <div
                key={section.id}
                className="bg-[image:var(--sf-brand-fill,linear-gradient(90deg,var(--sf-color-primary-hover,#0B5D57),var(--sf-color-primary,#0F766E)))] py-2.5 text-center text-[12.5px] font-bold text-[var(--sf-color-primary-foreground,#FFFFFF)]"
              >
                <div>{str(section.settings.text)}</div>
                {str(section.settings.subtitle) ? (
                  <div className="mt-0.5 text-[11px] font-semibold text-[var(--sf-color-text-muted,#576B66)] opacity-90">
                    {str(section.settings.subtitle)}
                  </div>
                ) : null}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="sticky top-0 z-30 border-b border-[var(--sf-color-border,#E6EEEB)] bg-[color-mix(in_srgb,var(--sf-color-surface,#FFFFFF)_92%,transparent)] backdrop-blur-xl"
              >
                <div className="mx-auto flex h-[68px] max-w-[var(--sf-container-max,1200px)] items-center justify-between gap-3 px-4">
                  <div className="flex items-center gap-2.5 text-[18px] font-black">
                    <span className="grid size-9 place-items-center rounded-xl bg-[image:var(--sf-brand-fill,linear-gradient(135deg,var(--sf-color-primary,#0F766E),var(--sf-color-primary-hover,#0B5D57)))] font-black text-[var(--sf-color-primary-foreground,#FFFFFF)]">
                      {storeName.slice(0, 1)}
                    </span>
                    {storeName}
                  </div>
                  {section.settings.showSearch !== false ? (
                    <label className="hidden min-w-[220px] items-center gap-2 rounded-full border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] px-3.5 py-2.5 text-[13px] text-[var(--sf-color-text-muted,#576B66)] sm:flex">
                      <Search className="size-4" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ابحث عن منتج…"
                        className="w-full bg-transparent outline-none"
                      />
                    </label>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {section.settings.showCart !== false ? (
                      <button
                        type="button"
                        onClick={() => setLocation("/store/checkout")}
                        className="relative grid size-10 place-items-center rounded-xl border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] text-[var(--sf-color-text,#0C2A26)]"
                        aria-label="السلة"
                      >
                        <ShoppingCart className="size-[18px]" />
                        {itemCount > 0 && (
                          <span className="absolute -left-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[var(--sf-color-primary,#0F766E)] px-1 text-[10px] font-extrabold text-white">
                            {itemCount}
                          </span>
                        )}
                      </button>
                    ) : null}
                    {section.settings.showAccount !== false ? (
                      <button
                        type="button"
                        className="hidden size-10 place-items-center rounded-xl border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] text-[var(--sf-color-text,#0C2A26)] sm:grid"
                        aria-label="الحساب"
                      >
                        <UserRound className="size-[18px]" />
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
                className="relative grid min-h-[440px] items-end overflow-hidden bg-[radial-gradient(120%_100%_at_80%_0%,rgba(94,234,212,0.45),transparent_60%),var(--sf-brand-fill,linear-gradient(135deg,var(--sf-color-primary-hover,#0B5D57),var(--sf-color-primary,#0F766E)_55%,var(--sf-color-primary,#0F766E)))]"
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
                <div className="relative z-10 mx-auto w-full max-w-[var(--sf-container-max,1200px)] px-4 py-12 text-white">
                  {str(section.settings.eyebrow) ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-[12px] font-extrabold">
                      ✦ {str(section.settings.eyebrow)}
                    </span>
                  ) : null}
                  <h1 className="mt-4 mb-3 max-w-[16ch] text-[34px] font-black leading-[1.25] sm:text-[52px]">
                    {str(section.settings.title, storeName)}
                  </h1>
                  <p className="mb-5 max-w-[46ch] text-[14px] leading-8 text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-90 sm:text-[17px]">
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
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--sf-color-surface,#FFFFFF)] px-6 py-3.5 text-[15px] font-extrabold text-[var(--sf-color-primary,#0F766E)]"
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
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-14"
              >
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[26px] font-black sm:text-[30px]">
                      {str(section.settings.title, "تسوق حسب الفئة")}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[var(--sf-color-text-muted,#576B66)]">
                      {str(section.settings.subtitle)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {categoriesQuery.isLoading ? (
                    <div className="col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:col-span-4">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-[120px] animate-pulse rounded-[var(--sf-radius-lg,22px)] bg-[var(--sf-color-surface-muted,#F3F7F6)]"
                        />
                      ))}
                    </div>
                  ) : null}
                  {categoryTiles(
                    section,
                    publicCategories,
                    collections.length
                      ? collections
                      : ["ملابس", "عناية", "إكسسوارات", "إلكترونيات"],
                    categoriesQuery.isLoading
                  ).map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        item.slug
                          ? setLocation(`/store/category/${item.slug}`)
                          : setSearch(item.name)
                      }
                      className="flex min-h-[120px] items-end rounded-[var(--sf-radius-lg,22px)] bg-cover bg-center p-4 text-right font-black text-white"
                      style={
                        item.imageUrl
                          ? { backgroundImage: `url(${item.imageUrl})` }
                          : item.bg
                            ? { background: item.bg }
                            : {
                                background: [
                                  "var(--sf-brand-fill,linear-gradient(135deg,var(--sf-color-primary,#0F766E),var(--sf-color-primary-hover,#0B5D57)))",
                                  "var(--sf-accent-fill,linear-gradient(135deg,var(--sf-color-accent,#B45309),color-mix(in srgb, var(--sf-color-accent,#B45309) 62%, black)))",
                                  "linear-gradient(135deg,#15803D,#14532D)",
                                  "linear-gradient(135deg,#334155,#0F172A)",
                                ][i % 4],
                              }
                      }
                    >
                      {item.name}
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
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-6"
              >
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[26px] font-black sm:text-[30px]">
                      {str(
                        section.settings.title,
                        section.type === "product_grid" ? "كل المنتجات" : "منتجات مميزة"
                      )}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[var(--sf-color-text-muted,#576B66)]">
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
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-6"
              >
                <div className="grid items-center gap-5 rounded-[var(--sf-radius-lg,22px)] bg-[image:var(--sf-brand-fill,linear-gradient(120deg,var(--sf-color-primary-hover,#0B5D57),var(--sf-color-primary,#0F766E)_60%,var(--sf-color-primary,#0F766E)))] p-8 text-white sm:grid-cols-[1.4fr_auto] sm:p-11">
                  <div>
                    <h2 className="text-[24px] font-black sm:text-[32px]">
                      {str(section.settings.title)}
                    </h2>
                    <p className="mt-2 text-[14px] leading-8 text-[var(--sf-color-primary-foreground,#FFFFFF)] opacity-85">
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
                    className="rounded-full bg-[var(--sf-color-surface,#FFFFFF)] px-6 py-3.5 text-[14px] font-extrabold text-[var(--sf-color-primary,#0F766E)]"
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
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-8"
              >
                {str(section.settings.title) ? (
                  <h2 className="mb-5 text-center text-[22px] font-black sm:text-[26px]">
                    {str(section.settings.title)}
                  </h2>
                ) : null}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {benefitRows(section, [
                    ["01", "توصيل سريع", "لجميع الولايات."],
                    ["02", "دفع عند الاستلام", "افحص قبل الدفع."],
                    ["03", "إرجاع 7 أيام", "استرجاع سهل."],
                    ["04", "دفع آمن", "بياناتك محمية."],
                  ]).map((row, index) => {
                    const Icon = sectionIcon(row.icon, DEFAULT_BENEFIT_ICONS[index % 4]);
                    return (
                      <div
                        key={row.id}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] p-4"
                        style={row.bg ? { backgroundColor: row.bg } : undefined}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sf-color-surface-muted,#F3F7F6)] text-[var(--sf-color-primary,#0F766E)]">
                          <Icon className="size-5" />
                        </span>
                        <span>
                          <b className="block text-[13.5px]">{row.title}</b>
                          <span className="text-[11.5px] text-[var(--sf-color-text-muted,#576B66)]">
                            {row.text}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          case "newsletter":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-8"
              >
                <div className="grid items-center gap-4 rounded-[var(--sf-radius-lg,22px)] border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface-muted,#F3F7F6)] p-7 sm:grid-cols-[1fr_auto] sm:p-9">
                  <div>
                    <h2 className="text-[22px] font-black">
                      {str(section.settings.title, "انضم إلى نشرتنا")}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-[var(--sf-color-text-muted,#576B66)]">
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
                      className="h-12 min-w-[200px] flex-1 rounded-full border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)] px-4 text-[14px] outline-none"
                    />
                    <button
                      type="submit"
                      className="h-12 rounded-full bg-[image:var(--sf-brand-fill,linear-gradient(135deg,var(--sf-color-primary,#0F766E),var(--sf-color-primary-hover,#0B5D57)))] px-6 text-[14px] font-extrabold text-[var(--sf-color-primary-foreground,#FFFFFF)]"
                    >
                      {str(section.settings.ctaLabel, "اشترك")}
                    </button>
                  </form>
                </div>
              </section>
            );
          case "footer":
            return (
              <footer key={section.id} className="mt-14 bg-[var(--sf-color-surface-raised,#0C2A26)] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-95">
                {(() => {
                  const footer = footerData(section, anchors);
                  return (
                    <div className="mx-auto grid max-w-[var(--sf-container-max,1200px)] gap-7 px-4 py-11 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="flex items-center gap-2.5 text-[18px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]">
                          <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#14B8A6,#0B5D57)] text-white">
                            {storeName.slice(0, 1)}
                          </span>
                          {storeName}
                        </div>
                        <p className="mt-3 max-w-[34ch] text-[12.5px] leading-7">
                          {footer.about ||
                            "تسوق بثقة — توصيل لكل الولايات والدفع عند الاستلام."}
                        </p>
                      </div>
                      <div>
                        <h3 className="mb-3 text-[15px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]">المتجر</h3>
                        <FooterStoreLinks footer={footer} />
                      </div>
                      <div>
                        <h3 className="mb-3 text-[15px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]">المساعدة</h3>
                        <FooterHelp footer={footer} />
                      </div>
                      <div>
                        <h3 className="mb-3 text-[15px] font-black text-[var(--sf-color-text-inverted,#FFFFFF)]">تابعنا</h3>
                        <FooterSocial footer={footer} />
                      </div>
                    </div>
                  );
                })()}
                <div className="mx-auto flex max-w-[var(--sf-container-max,1200px)] flex-wrap justify-between gap-2.5 border-t border-white/10 px-4 py-4 text-[12px] text-[var(--sf-color-text-inverted,#FFFFFF)] opacity-70">
                  <span>© {new Date().getFullYear()} {storeName}</span>
                  <span>جميع الحقوق محفوظة</span>
                </div>
              </footer>
            );
          case "signature":
            return (
              <section
                key={section.id}
                className="mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-10 text-center"
              >
                {(() => {
                  const sig = signatureStyle(section);
                  return (
                    <>
                      {sig.showOrnament ? (
                        <SignatureFlourish className="mb-3" />
                      ) : null}
                      <div style={sig.style} className="text-[26px] font-black sm:text-[34px]">
                        {sig.text || storeName}
                      </div>
                      {sig.subtitle ? (
                        <div
                          style={sig.style}
                          className="mt-2 text-[13.5px] text-[var(--sf-color-text-muted,#576B66)]"
                        >
                          {sig.subtitle}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>
            );
          case "testimonials":
            return null;
          case "offers":
            return (
              <StorefrontOffers
                key={section.id}
                section={section}
                offers={offersQuery.data ?? []}
                template="modern"
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
