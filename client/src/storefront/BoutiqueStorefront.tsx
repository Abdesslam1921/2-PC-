import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, UserRound } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { SectionShell, type SectionWrapperComponent } from "@/storefront/SectionShell";
import { SECTION_LABELS } from "@shared/storefront/sectionFields";
import { benefitRows, categoryTiles, footerData } from "@/storefront/sectionData";
import {
  FooterInlineLinks,
  SignatureFlourish,
  signatureStyle,
} from "@/storefront/FooterExtras";
import { sectionIcon, storefrontAnchors } from "@/storefront/sectionIcons";
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

const WRAP = "mx-auto w-full max-w-[var(--sf-container-max,1140px)] px-5 sm:px-7";
const LABEL =
  "text-[11px] uppercase tracking-[0.3em] text-[var(--sf-color-accent,#8A6A3B)]";

export function BoutiqueStorefront({
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
  const publicCategories = categoriesQuery.data ?? [];

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.collectionName) set.add(p.collectionName);
    return Array.from(set).slice(0, 3);
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
      <div className="grid min-h-screen place-items-center bg-[var(--sf-color-background,#FBF6EE)]">
        <Loader2 className="size-8 animate-spin text-[var(--sf-color-accent,#B45309)]" />
      </div>
    );
  }

  const sections = [...config.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--sf-color-background,#FBF6EE)] text-[var(--sf-color-text,#2B211A)]">
      {sections.map(section => {
        const content = (() => {
          switch (section.type) {
          case "announcement":
            return (
              <div
                key={section.id}
                className="border-b border-[var(--sf-color-border,#EADFCE)] bg-[var(--sf-color-surface,#FFFFFF)] py-3.5 text-center text-[11.5px] uppercase tracking-[0.16em] text-[var(--sf-color-text-muted,#6B5F52)]"
              >
                <div>{str(section.settings.text)}</div>
                {str(section.settings.subtitle) ? (
                  <div className="mt-1 text-[10.5px] normal-case tracking-normal text-[var(--sf-color-text-muted,#6B5F52)] opacity-90">
                    {str(section.settings.subtitle)}
                  </div>
                ) : null}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="sticky top-0 z-30 border-b border-[var(--sf-color-border,#EADFCE)] bg-[color-mix(in_srgb,var(--sf-color-background,#FBF6EE)_92%,transparent)] backdrop-blur-md"
              >
                <div className={`${WRAP} flex items-center justify-between gap-3.5 py-3.5`}>
                  <div className="flex items-center gap-3">
                    {section.settings.showSearch !== false ? (
                      <label className="hidden items-center gap-2 border-b border-[var(--sf-color-border,#EADFCE)] py-1 text-[12px] text-[var(--sf-color-text-muted,#6B5F52)] sm:flex">
                        <Search className="size-4" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="ابحث…"
                          className="w-24 bg-transparent outline-none"
                        />
                      </label>
                    ) : null}
                    {section.settings.showAccount !== false ? (
                      <button
                        type="button"
                        className="hidden text-[var(--sf-color-text-muted,#6B5F52)] hover:text-[var(--sf-color-accent,#B45309)] sm:grid"
                        aria-label="الحساب"
                      >
                        <UserRound className="size-[18px]" />
                      </button>
                    ) : null}
                    {section.settings.showCart !== false ? (
                      <button
                        type="button"
                        onClick={() => setLocation("/store/cart")}
                        className="text-[12px] uppercase tracking-[0.12em] text-[var(--sf-color-text-muted,#6B5F52)] transition hover:text-[var(--sf-color-accent,#B45309)]"
                      >
                        السلة ({itemCount})
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <b className="text-[21px] font-bold tracking-[0.01em]">
                      {storeName}
                    </b>
                    <span className="text-[9.5px] uppercase tracking-[0.32em] text-[var(--sf-color-accent,#B45309)]">
                      Boutique
                    </span>
                  </div>
                  <nav className="hidden gap-[26px] text-[12px] uppercase tracking-[0.14em] text-[var(--sf-color-text-muted,#6B5F52)] sm:flex">
                    {collections.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          setActiveCollection(c => (c === name ? null : name))
                        }
                        className="hover:text-[var(--sf-color-accent,#B45309)]"
                      >
                        {name}
                      </button>
                    ))}
                    <a href="#about" className="hover:text-[var(--sf-color-accent,#B45309)]">
                      عن العلامة
                    </a>
                  </nav>
                </div>
              </header>
            );
          case "hero":
            return (
              <section key={section.id} className={WRAP}>
                <div className="grid items-center gap-8 py-11 sm:py-20 lg:grid-cols-2 lg:gap-14">
                  <div>
                    <span className={`inline-block ${LABEL}`}>
                      ✦ {str(section.settings.eyebrow, "مجموعة")}
                    </span>
                    <h1 className="mt-4 mb-3.5 max-w-[22ch] text-[30px] font-semibold leading-[1.3] tracking-[-0.01em] sm:text-[52px]">
                      {str(section.settings.title, storeName)}
                    </h1>
                    <p className="mb-6 max-w-[48ch] text-[14.5px] font-light leading-9 text-[var(--sf-color-text-muted,#6B5F52)]">
                      {str(section.settings.subtitle)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("boutique-grid")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="inline-flex items-center gap-2.5 rounded-full border border-[var(--sf-color-primary,#2B211A)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#2B211A)] px-7 py-3.5 text-[14px] font-bold text-[var(--sf-color-primary-foreground,#FFFFFF)] transition hover:bg-none hover:bg-[var(--sf-color-primary-hover,#1F1813)] hover:border-[var(--sf-color-primary-hover,#1F1813)]"
                    >
                      {str(section.settings.ctaLabel, "اكتشف المجموعة")}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="relative rounded-[var(--sf-radius-lg,26px)] border border-[var(--sf-color-accent-soft,#E9C77B)] bg-[var(--sf-color-surface,#FFFFFF)] p-3">
                      <div
                        className="h-[240px] rounded-[20px] bg-cover bg-center bg-[radial-gradient(90%_80%_at_25%_20%,rgba(233,199,123,0.55),transparent_60%),linear-gradient(150deg,var(--sf-color-surface-muted,#F6EFE2),color-mix(in_srgb,var(--sf-color-surface-muted,#F6EFE2)_78%,black))] sm:h-[400px]"
                        style={
                          typeof section.settings.imageUrl === "string" &&
                          section.settings.imageUrl
                            ? {
                                backgroundImage: `url(${section.settings.imageUrl})`,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          case "featured_products":
          case "product_grid":
            return (
              <section
                key={section.id}
                id="boutique-grid"
                className={`${WRAP} py-11 sm:py-16`}
              >
                <div className="mb-9 text-center">
                  {str(section.settings.subtitle) ? (
                    <span className={LABEL}>✦ {str(section.settings.subtitle)} ✦</span>
                  ) : null}
                  <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.01em] sm:text-[34px]">
                    {str(section.settings.title, "المجموعة")}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-[22px] sm:grid-cols-3 sm:gap-x-[22px] sm:gap-y-[26px]">
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
                      return (
                        <article key={product.id} className="group text-center">
                          <button
                            type="button"
                            onClick={() => setLocation(`/p/${product.id}`)}
                            className="relative block aspect-[4/5] w-full overflow-hidden rounded-[var(--sf-radius-lg,26px)] border border-[var(--sf-color-border,#EADFCE)] bg-[linear-gradient(145deg,var(--sf-color-surface-muted,#F6EFE2),color-mix(in_srgb,var(--sf-color-surface-muted,#F6EFE2)_80%,black))] transition duration-300 group-hover:-translate-y-1.5 group-hover:border-[var(--sf-color-accent-soft,#E9C77B)] group-hover:shadow-[0_20px_40px_-26px_rgba(43,33,26,0.45)]"
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
                              <span className="absolute right-3 top-3 rounded-full border border-[var(--sf-color-accent-soft,#E9C77B)] bg-[var(--sf-color-surface,#FFFFFF)] px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--sf-color-accent,#B45309)]">
                                -{discount}%
                              </span>
                            ) : null}
                          </button>
                          <h3 className="mt-4 text-[15px] font-semibold">
                            {product.title}
                          </h3>
                          <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--sf-color-accent,#B45309)]">
                            {product.collectionName ?? "قطعة مختارة"}
                          </div>
                          <div className="mt-2 text-[14px] text-[var(--sf-color-text-muted,#6B5F52)]">
                            <b className="font-bold text-[var(--sf-color-accent,#B45309)]">
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
                            className="mt-3 rounded-full border border-[var(--sf-color-accent-soft,#E9C77B)] px-[22px] py-2.5 text-[11.5px] uppercase tracking-[0.14em] text-[var(--sf-color-text,#2B211A)] transition hover:border-[var(--sf-color-primary,#2B211A)] hover:bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#2B211A)] hover:text-[var(--sf-color-primary-foreground,#FFFFFF)]"
                          >
                            أضف إلى السلة
                          </button>
                        </article>
                      );
                    })}
                </div>
              </section>
            );
          case "promo":
            return (
              <section key={section.id} className={`${WRAP} py-6`}>
                <div className="relative rounded-[var(--sf-radius-lg,26px)] border border-[var(--sf-color-accent-soft,#E9C77B)] bg-[var(--sf-color-surface,#FFFFFF)] px-8 py-14 text-center sm:px-16">
                  <span className="absolute right-4 top-3.5 text-[14px] text-[var(--sf-color-accent-soft,#E9C77B)]">
                    ✦
                  </span>
                  <span className="absolute bottom-3.5 left-4 text-[14px] text-[var(--sf-color-accent-soft,#E9C77B)]">
                    ✦
                  </span>
                  <span className={LABEL}>✦ هدية الموسم ✦</span>
                  <h2 className="mt-3.5 text-[22px] font-semibold sm:text-[34px]">
                    {str(section.settings.title)}
                  </h2>
                  <p className="mx-auto mt-3.5 mb-6 max-w-[50ch] text-[14px] font-light text-[var(--sf-color-text-muted,#6B5F52)]">
                    {str(section.settings.body)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("boutique-grid")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="rounded-full border border-[var(--sf-color-primary,#2B211A)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#2B211A)] px-7 py-3.5 text-[14px] font-bold text-[var(--sf-color-primary-foreground,#FFFFFF)] transition hover:bg-none hover:bg-[var(--sf-color-primary-hover,#1F1813)] hover:border-[var(--sf-color-primary-hover,#1F1813)]"
                  >
                    {str(section.settings.ctaLabel, "اطلب الآن")}
                  </button>
                </div>
              </section>
            );
          case "benefits":
            return (
              <section
                key={section.id}
                id="about"
                className={`${WRAP} py-11 sm:py-16`}
              >
                {str(section.settings.title) ? (
                  <h2 className="mb-6 text-center text-[22px] font-semibold sm:text-[26px]">
                    {str(section.settings.title)}
                  </h2>
                ) : null}
                <div className="grid border-y border-[var(--sf-color-border,#EADFCE)] sm:grid-cols-2 sm:column-gap-10">
                  {benefitRows(section, [
                    ["01", "توصيل فاخر", "تغليف أنيق لكل الولايات."],
                    ["02", "دفع عند الاستلام", "افحص طلبك قبل الدفع."],
                    ["03", "إرجاع خلال 7 أيام", "استرجاع هادئ بلا تعقيد."],
                    ["04", "خامات أصلية", "مصادر موثوقة وضمان جودة."],
                  ]).map(row => {
                    const Icon = row.icon ? sectionIcon(row.icon, Sparkles) : null;
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-3.5 border-b border-[var(--sf-color-border,#EADFCE)] px-1.5 py-5 last:border-b-0 sm:[&:nth-child(odd)]:border-b"
                        style={row.bg ? { backgroundColor: row.bg } : undefined}
                      >
                        <span className="grid size-[34px] shrink-0 place-items-center rounded-full border border-[var(--sf-color-accent-soft,#E9C77B)] text-[13px] text-[var(--sf-color-accent,#B45309)]">
                          {Icon ? <Icon className="size-4" /> : "✦"}
                        </span>
                        <span>
                          <b className="block text-[14px] font-semibold">{row.title}</b>
                          <span className="text-[12.5px] font-light text-[var(--sf-color-text-muted,#6B5F52)]">
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
              <section key={section.id} className={`${WRAP} py-10 sm:py-14`}>
                <div className="rounded-[var(--sf-radius-lg,26px)] border border-[var(--sf-color-border,#EADFCE)] bg-[var(--sf-color-surface,#FFFFFF)] px-7 py-12 text-center sm:px-14">
                  <span className={LABEL}>✦ النشرة ✦</span>
                  <h2 className="mt-3.5 text-[22px] font-semibold sm:text-[32px]">
                    {str(section.settings.title, "رسائل راقية فقط")}
                  </h2>
                  <p className="mt-3 mb-6 text-[13.5px] font-light text-[var(--sf-color-text-muted,#6B5F52)]">
                    {str(section.settings.subtitle)}
                  </p>
                  <form
                    className="flex flex-wrap justify-center gap-2.5"
                    onSubmit={e => e.preventDefault()}
                  >
                    <input
                      type="email"
                      placeholder="بريدك الإلكتروني"
                      className="h-[50px] min-w-[220px] max-w-[340px] flex-1 rounded-full border border-[var(--sf-color-border,#EADFCE)] bg-[var(--sf-color-background,#FBF6EE)] px-5 text-[14px] outline-none focus:border-[var(--sf-color-accent-soft,#E9C77B)]"
                    />
                    <button
                      type="submit"
                      className="h-[50px] rounded-full border border-[var(--sf-color-primary,#2B211A)] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[image:var(--sf-brand-fill,linear-gradient(var(--sf-color-primary),var(--sf-color-primary)))] bg-[var(--sf-color-primary,#2B211A)] px-7 text-[13px] font-bold tracking-[0.08em] text-[var(--sf-color-primary-foreground,#FFFFFF)] transition hover:bg-none hover:bg-[var(--sf-color-primary-hover,#1F1813)] hover:border-[var(--sf-color-primary-hover,#1F1813)]"
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
                className="mt-16 border-t border-[var(--sf-color-border,#EADFCE)] py-11"
              >
                <div className={`${WRAP} grid gap-6 text-center`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <b className="text-[20px] font-bold">{storeName}</b>
                    <span className="text-[9.5px] uppercase tracking-[0.32em] text-[var(--sf-color-accent,#B45309)]">
                      Boutique
                    </span>
                  </div>
                  {(() => {
                    const footer = footerData(section, anchors);
                    return (
                      <>
                        {footer.about ? (
                          <p className="mx-auto max-w-[46ch] text-[12.5px] font-light text-[var(--sf-color-text-muted,#6B5F52)]">
                            {footer.about}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2.5 text-[12px] uppercase tracking-[0.1em] text-[var(--sf-color-text-muted,#6B5F52)]">
                          <FooterInlineLinks
                            footer={footer}
                            itemClass="hover:text-[var(--sf-color-accent,#B45309)]"
                          />
                        </div>
                        {footer.trackOrder || footer.returns ? (
                          <div className="mx-auto max-w-[52ch] space-y-1 text-[11.5px] font-light text-[var(--sf-color-text-muted,#6B5F52)]">
                            {footer.trackOrder ? <p>تتبع الطلب: {footer.trackOrder}</p> : null}
                            {footer.returns ? <p>الإرجاع: {footer.returns}</p> : null}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                  <div className="text-[11.5px] text-[var(--sf-color-accent,#B45309)]">
                    © {new Date().getFullYear()} {storeName} — جميع الحقوق محفوظة
                  </div>
                </div>
              </footer>
            );
          case "categories":
            return (
              <section key={section.id} className={`${WRAP} py-11 sm:py-16`}>
                <div className="mb-9 text-center">
                  <h2 className="text-[22px] font-semibold sm:text-[34px]">
                    {str(section.settings.title, "تسوق حسب الفئة")}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-4">
                  {categoriesQuery.isLoading ? (
                    <div className="col-span-2 grid grid-cols-2 gap-[18px] sm:grid-cols-4 sm:col-span-4">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-[120px] animate-pulse rounded-[var(--sf-radius-lg,26px)] bg-[var(--sf-color-surface-muted,#F6EFE2)]"
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
                      className="flex min-h-[120px] items-end rounded-[var(--sf-radius-lg,26px)] border border-[var(--sf-color-accent-soft,#E9C77B)] bg-[linear-gradient(145deg,var(--sf-color-surface-muted,#F6EFE2),color-mix(in_srgb,var(--sf-color-surface-muted,#F6EFE2)_80%,black))] bg-cover bg-center p-4 text-right font-semibold text-[var(--sf-color-text,#2B211A)]"
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
              <section key={section.id} className={`${WRAP} py-12 text-center`}>
                {(() => {
                  const sig = signatureStyle(section);
                  return (
                    <>
                      {sig.showOrnament ? (
                        <SignatureFlourish className="mb-3" />
                      ) : null}
                      <div style={sig.style} className="text-[26px] font-semibold sm:text-[34px]">
                        {sig.text || storeName}
                      </div>
                      {sig.subtitle ? (
                        <div
                          style={sig.style}
                          className="mt-2 text-[12.5px] font-light text-[var(--sf-color-text-muted,#6B5F52)]"
                        >
                          {sig.subtitle}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>
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
