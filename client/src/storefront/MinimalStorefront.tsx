import { useMemo, useState } from "react";
import { StorefrontOffers } from "@/storefront/OfferSection";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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

const LABEL = "text-[11px] uppercase tracking-[0.22em] text-[var(--sf-color-accent,#0F766E)]";
const WRAP = "mx-auto w-full max-w-[var(--sf-container-max,1080px)] px-5 sm:px-8";

export function MinimalStorefront({
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
    return Array.from(set).slice(0, 3);
  }, [products]);

  const anchors = useMemo(() => storefrontAnchors(config), [config]);

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
        <Loader2 className="size-8 animate-spin text-[var(--sf-color-primary,#0F766E)]" />
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
                className="border-b border-[var(--sf-color-border,#E7E9E8)] bg-[var(--sf-color-surface,#FFFFFF)] py-3.5 text-center text-[11.5px] uppercase tracking-[0.18em] text-[var(--sf-color-text-muted,#576B66)]"
              >
                <div>{str(section.settings.text)}</div>
                {str(section.settings.subtitle) ? (
                  <div className="mt-1 text-[10.5px] normal-case tracking-normal text-[var(--sf-color-text-muted,#576B66)] opacity-90">
                    {str(section.settings.subtitle)}
                  </div>
                ) : null}
              </div>
            );
          case "header":
            return (
              <header
                key={section.id}
                className="border-b border-[var(--sf-color-border,#E7E9E8)] bg-[var(--sf-color-surface,#FFFFFF)]"
              >
                <div className={`${WRAP} flex h-[66px] items-center justify-between gap-4`}>
                  <span className="text-[16px] font-bold tracking-[0.02em]">
                    {storeName}
                  </span>
                  <nav className="hidden gap-[30px] text-[12px] uppercase tracking-[0.16em] text-[var(--sf-color-text-muted,#576B66)] sm:flex">
                    <a href="#grid" className="hover:text-[var(--sf-color-text,#0C2A26)]">
                      المتجر
                    </a>
                    {collections[0] ? (
                      <button
                        type="button"
                        onClick={() => setSearch(collections[0])}
                        className="hover:text-[var(--sf-color-text,#0C2A26)]"
                      >
                        {collections[0]}
                      </button>
                    ) : null}
                    <a href="#about" className="hover:text-[var(--sf-color-text,#0C2A26)]">
                      عن العلامة
                    </a>
                  </nav>
                  {section.settings.showSearch !== false ? (
                    <label className="hidden items-center gap-2 border-b border-[var(--sf-color-border,#E7E9E8)] py-1 text-[12px] text-[var(--sf-color-text-muted,#576B66)] sm:flex">
                      <Search className="size-4" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ابحث…"
                        className="w-32 bg-transparent outline-none"
                      />
                    </label>
                  ) : null}
                  {section.settings.showAccount !== false ? (
                    <button
                      type="button"
                      className="hidden text-[12px] uppercase tracking-[0.1em] text-[var(--sf-color-text-muted,#576B66)] hover:text-[var(--sf-color-text,#0C2A26)] sm:block"
                      aria-label="الحساب"
                    >
                      الحساب
                    </button>
                  ) : null}
                  {section.settings.showCart !== false ? (
                    <button
                      type="button"
                      onClick={() => setLocation("/store/cart")}
                      className="border-b border-transparent text-[12px] tracking-[0.1em] transition hover:border-[var(--sf-color-primary-hover,#0B5D57)] hover:text-[var(--sf-color-primary-hover,#0B5D57)]"
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
                  <p className="mt-6 max-w-[52ch] text-[14px] font-light leading-9 text-[var(--sf-color-text-muted,#576B66)] sm:text-[16px]">
                    {str(section.settings.subtitle)}
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-7">
                    <a
                      href="#grid"
                      className="border-b border-[var(--sf-color-primary,#0F766E)] pb-1 text-[13px] uppercase tracking-[0.12em] text-[var(--sf-color-primary,#0F766E)] transition hover:border-[var(--sf-color-primary-hover,#0B5D57)] hover:text-[var(--sf-color-primary-hover,#0B5D57)]"
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
                className={`${WRAP} border-t border-[var(--sf-color-border,#E7E9E8)] py-20`}
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
                        <div key={product.id} className="group rounded-[var(--sf-radius-lg,3px)] bg-[var(--sf-color-surface,#FFFFFF)]">
                          <button
                            type="button"
                            onClick={() => setLocation(`/p/${product.id}`)}
                            className="block aspect-[4/5] w-full overflow-hidden rounded-[var(--sf-radius-lg,3px)] bg-[var(--sf-color-surface-muted,#F4F5F4)] transition group-hover:opacity-80"
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
                          <div className="text-[13px] text-[var(--sf-color-text-muted,#576B66)]">
                            <b className="font-semibold text-[var(--sf-color-text,#0C2A26)]">
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
                            className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--sf-color-primary,#0F766E)] transition hover:text-[var(--sf-color-primary-hover,#0B5D57)]"
                          >
                            أضف إلى السلة
                          </button>
                        </div>
                      );
                    })}
                  {!visible.length && (
                    <p className="col-span-full text-sm text-[var(--sf-color-text-muted,#576B66)]">
                      لا توجد منتجات منشورة بعد.
                    </p>
                  )}
                </div>
              </section>
            );
          case "promo":
            return (
              <section key={section.id} className={WRAP}>
                <div className="border border-[var(--sf-color-border,#E7E9E8)] bg-[var(--sf-color-surface,#FFFFFF)] px-8 py-14 text-center sm:px-16">
                  <span className={LABEL}>لفترة محدودة</span>
                  <h2 className="mt-4 text-[22px] font-semibold sm:text-[28px]">
                    {str(section.settings.title)}
                  </h2>
                  <p className="mx-auto mt-4 mb-7 max-w-[48ch] text-[14px] font-light text-[var(--sf-color-text-muted,#576B66)]">
                    {str(section.settings.body)}
                  </p>
                  <a
                    href="#grid"
                    className="border-b border-[var(--sf-color-primary,#0F766E)] pb-1 text-[13px] uppercase tracking-[0.12em] text-[var(--sf-color-primary,#0F766E)] transition hover:border-[var(--sf-color-primary-hover,#0B5D57)] hover:text-[var(--sf-color-primary-hover,#0B5D57)]"
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
                className={`${WRAP} mt-20 border-t border-[var(--sf-color-border,#E7E9E8)] py-16`}
              >
                <h2 className="mb-8 text-[22px] font-semibold sm:text-[26px]">
                  {str(section.settings.title, "لماذا نحن")}
                </h2>
                <div className="grid sm:grid-cols-2 sm:gap-x-12">
                  {benefitRows(section, [
                    ["01", "توصيل سريع", "لجميع الولايات خلال 48–72 ساعة."],
                    ["02", "دفع عند الاستلام", "افحص طلبك قبل الدفع."],
                    ["03", "إرجاع خلال 7 أيام", "استرجاع بسيط بلا تعقيد."],
                    ["04", "دفع آمن", "بياناتك محمية دائمًا."],
                  ]).map(row => (
                    <div
                      key={row.id}
                      className="flex items-baseline gap-3.5 border-b border-[var(--sf-color-border,#E7E9E8)] py-5"
                      style={row.bg ? { backgroundColor: row.bg } : undefined}
                    >
                      <span className="text-[11px] tracking-[0.16em] text-[var(--sf-color-text-muted,#576B66)]">
                        {row.num}
                      </span>
                      <span>
                        <b className="block text-[13.5px] font-semibold">{row.title}</b>
                        <span className="text-[12.5px] font-light text-[var(--sf-color-text-muted,#576B66)]">
                          {row.text}
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
                <p className="mt-3 mb-8 text-[13.5px] font-light text-[var(--sf-color-text-muted,#576B66)]">
                  {str(section.settings.subtitle)}
                </p>
                <form
                  className="mx-auto flex max-w-[440px] border-b border-[var(--sf-color-text,#0C2A26)]"
                  onSubmit={e => e.preventDefault()}
                >
                  <input
                    type="email"
                    placeholder="بريدك الإلكتروني"
                    className="flex-1 bg-transparent px-1 py-3 text-[13.5px] outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-3 text-[12px] uppercase tracking-[0.14em] text-[var(--sf-color-primary,#0F766E)] transition hover:text-[var(--sf-color-primary-hover,#0B5D57)]"
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
                className="border-t border-[var(--sf-color-border,#E7E9E8)] py-8"
              >
                {(() => {
                  const footer = footerData(section, anchors);
                  return (
                    <div
                      className={`${WRAP} flex flex-wrap items-center justify-between gap-3.5 text-[12px] text-[var(--sf-color-text-muted,#576B66)]`}
                    >
                      <span>© {new Date().getFullYear()} {storeName}</span>
                      <div className="flex flex-wrap gap-x-6 gap-y-2.5 tracking-[0.06em]">
                        <FooterInlineLinks
                          footer={footer}
                          itemClass="hover:text-[var(--sf-color-text,#0C2A26)]"
                        />
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const footer = footerData(section, anchors);
                  return (
                    <div
                      className={`${WRAP} mt-4 space-y-1 text-[12px] text-[var(--sf-color-text-muted,#576B66)]`}
                    >
                      {footer.trackOrder ? (
                        <p>تتبع الطلب: {footer.trackOrder}</p>
                      ) : null}
                      {footer.returns ? <p>الإرجاع: {footer.returns}</p> : null}
                    </div>
                  );
                })()}
              </footer>
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
                      <div style={sig.style} className="text-[24px] font-semibold sm:text-[30px]">
                        {sig.text || storeName}
                      </div>
                      {sig.subtitle ? (
                        <div
                          style={sig.style}
                          className="mt-2 text-[12.5px] font-light text-[var(--sf-color-text-muted,#576B66)]"
                        >
                          {sig.subtitle}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>
            );
          case "categories":
            return (
              <section
                key={section.id}
                className={`${WRAP} border-t border-[var(--sf-color-border,#E7E9E8)] py-20`}
              >
                <div className="mb-11">
                  <h2 className="text-[22px] font-semibold tracking-[-0.01em] sm:text-[26px]">
                    {str(section.settings.title, "تسوق حسب الفئة")}
                  </h2>
                  <p className="mt-2 text-[13px] font-light text-[var(--sf-color-text-muted,#576B66)]">
                    {str(section.settings.subtitle)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-[22px] gap-y-[34px] sm:grid-cols-3 lg:grid-cols-4">
                  {categoriesQuery.isLoading ? (
                    <div className="col-span-2 grid grid-cols-2 gap-x-[22px] gap-y-[34px] sm:grid-cols-3 lg:grid-cols-4">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="aspect-[4/5] w-full animate-pulse rounded-[var(--sf-radius-lg,3px)] bg-[var(--sf-color-surface-muted,#F4F5F4)]"
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
                      className="group text-right"
                    >
                      <span
                        className="block aspect-[4/5] w-full rounded-[var(--sf-radius-lg,3px)] border border-[var(--sf-color-border,#E7E9E8)] bg-[var(--sf-color-surface-muted,#F4F5F4)] bg-cover bg-center transition group-hover:opacity-80"
                        style={
                          item.imageUrl
                            ? { backgroundImage: `url(${item.imageUrl})` }
                            : item.bg
                              ? { backgroundColor: item.bg }
                              : undefined
                        }
                      />
                      <span className="mt-3 block text-[13.5px] font-medium">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          case "offers":
            return (
              <StorefrontOffers
                key={section.id}
                section={section}
                offers={offersQuery.data ?? []}
                template="minimal"
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
