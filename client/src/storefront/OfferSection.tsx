import { BadgePercent, ShoppingBag, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { offerCards, type PublicOffer } from "@/storefront/sectionData";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";
import type { StorefrontSection } from "@shared/storefront/storefrontConfig";

type TemplateKey = StorefrontConfig["templateKey"];

const money = (value: number) =>
  `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(value)} دج`;

/**
 * Storefront offers (bundles) section.
 *
 * Shared by the four templates (each with its own visual identity) and rendered
 * ONLY when the store has at least one active, fully available offer — the
 * server already filters them, so an empty list renders nothing at all.
 *
 * "اشتري الباقة" adds every product of the bundle to the existing cart (same
 * cart, same stock rules) and applies the bundle discount as a cart-level line.
 */
export function StorefrontOffers({
  section,
  offers,
  template,
}: {
  section: StorefrontSection;
  offers: PublicOffer[];
  template: TemplateKey;
}) {
  const { addItem, applyBundle } = useCart();
  const [, setLocation] = useLocation();
  const cards = offerCards(offers);
  if (!cards.length) return null;

  const title = typeof section.settings.title === "string" ? section.settings.title : "";
  const subtitle =
    typeof section.settings.subtitle === "string" ? section.settings.subtitle : "";

  const buy = (card: (typeof cards)[number]) => {
    for (const item of card.items) {
      addItem(
        {
          productId: item.productId,
          title: item.title,
          imageUrl: item.imageUrl ?? undefined,
          price: item.price ?? "0",
          maxQuantity:
            item.trackInventory && !item.continueSelling
              ? item.inventory
              : undefined,
        },
        item.quantity
      );
    }
    applyBundle({
      offerId: card.id,
      name: card.name,
      unitAmount: card.discountAmount,
      freeDelivery: card.freeDelivery,
      items: card.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
  };

  const tone = {
    modern: {
      wrap: "mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-14",
      heading: "text-[24px] font-black sm:text-[30px]",
      sub: "mt-2 text-[13px] text-[var(--sf-color-text-muted,#576B66)]",
      grid: "mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
      card: "overflow-hidden rounded-[var(--sf-radius-lg,22px)] border border-[var(--sf-color-border,#E6EEEB)] bg-[var(--sf-color-surface,#FFFFFF)]",
      image: "h-40 w-full",
      body: "space-y-2 p-4",
      name: "text-[15px] font-black",
      itemLine: "text-[12px] text-[var(--sf-color-text-muted,#576B66)]",
      price: "text-[16px] font-black text-[var(--sf-color-primary,#0F766E)]",
      old: "text-[12.5px] text-[var(--sf-color-text-muted,#576B66)] line-through",
      button:
        "mt-2 w-full rounded-full bg-[image:var(--sf-brand-fill,linear-gradient(135deg,var(--sf-color-primary,#0F766E),var(--sf-color-primary-hover,#0B5D57)))] py-3 text-[13px] font-extrabold text-[var(--sf-color-primary-foreground,#FFFFFF)]",
    },
    minimal: {
      wrap: "mx-auto max-w-[860px] px-6 py-16",
      heading: "text-[26px] font-semibold tracking-tight sm:text-[34px]",
      sub: "mt-3 text-[13px] font-light text-[var(--sf-color-text-muted,#576B66)]",
      grid: "mt-9 grid gap-x-8 gap-y-10 sm:grid-cols-2",
      card: "border-t border-[var(--sf-color-border,#E7E9E8)] pt-5",
      image: "h-40 w-full rounded-[var(--sf-radius-lg,3px)] bg-[var(--sf-color-surface-muted,#F4F5F4)] object-cover",
      body: "mt-4 space-y-1.5",
      name: "text-[15px] font-medium",
      itemLine: "text-[12px] font-light text-[var(--sf-color-text-muted,#576B66)]",
      price: "text-[15px] font-semibold",
      old: "text-[12px] text-[var(--sf-color-text-muted,#576B66)] line-through",
      button:
        "mt-3 border-b border-[var(--sf-color-primary,#0F766E)] pb-0.5 text-[12px] uppercase tracking-[0.12em] text-[var(--sf-color-primary,#0F766E)]",
    },
    bold: {
      wrap: "mx-auto max-w-[var(--sf-container-max,1200px)] px-4 py-16",
      heading: "text-[26px] font-black uppercase sm:text-[34px]",
      sub: "mt-2 text-[13px] font-semibold text-[var(--sf-color-text-muted,#576B66)]",
      grid: "mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
      card: "border-[3px] border-[#0C2A26] bg-[var(--sf-color-surface,#FFFFFF)] shadow-[8px_8px_0_0_var(--sf-color-text,#0C2A26)]",
      image: "h-40 w-full",
      body: "space-y-2 p-4",
      name: "text-[16px] font-black",
      itemLine: "text-[12px] font-semibold text-[var(--sf-color-text-muted,#576B66)]",
      price: "text-[18px] font-black text-[var(--sf-color-primary,#F5B13D)]",
      old: "text-[12.5px] font-bold text-[var(--sf-color-text-muted,#576B66)] line-through",
      button:
        "mt-2 w-full border-[3px] border-[#0C2A26] bg-[var(--sf-color-primary,#F5B13D)] py-3 text-[13px] font-black text-[var(--sf-color-primary-foreground,#0C2A26)]",
    },
    boutique: {
      wrap: "mx-auto max-w-[1040px] px-6 py-16 text-center",
      heading: "text-[26px] font-semibold sm:text-[32px]",
      sub: "mt-3 text-[13px] font-light text-[var(--sf-color-text-muted,#6B5F52)]",
      grid: "mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 text-right",
      card: "border border-[var(--sf-color-accent-soft,#E9C77B)] bg-[var(--sf-color-surface,#FFFFFF)] p-4",
      image: "h-40 w-full rounded-[var(--sf-radius-lg,26px)] object-cover",
      body: "mt-4 space-y-2",
      name: "text-[15px] font-semibold",
      itemLine: "text-[12px] font-light text-[var(--sf-color-text-muted,#6B5F52)]",
      price: "text-[16px] font-bold text-[var(--sf-color-accent,#B45309)]",
      old: "text-[12px] font-light text-[var(--sf-color-text-muted,#6B5F52)] line-through",
      button:
        "mt-3 w-full rounded-full border border-[var(--sf-color-primary,#2B211A)] bg-[var(--sf-color-primary,#2B211A)] py-3 text-[12.5px] font-bold text-[var(--sf-color-primary-foreground,#FFFFFF)]",
    },
  }[template];

  return (
    <section className={tone.wrap}>
      {title ? <h2 className={tone.heading}>{title}</h2> : null}
      {subtitle ? <p className={tone.sub}>{subtitle}</p> : null}
      <div className={tone.grid}>
        {cards.map(card => (
          <article
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => setLocation(`/b/${card.slug}`)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setLocation(`/b/${card.slug}`);
              }
            }}
            className={`${tone.card} cursor-pointer transition hover:shadow-lift`}
          >
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                loading="lazy"
                className={tone.image}
              />
            ) : null}
            <div className={tone.body}>
              <h3 className={tone.name}>{card.name}</h3>
              <ul className="space-y-0.5">
                {card.items.map(item => (
                  <li key={item.productId} className={tone.itemLine}>
                    {item.title}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <span className={tone.old}>{money(card.originalTotal)}</span>
                <span className={tone.price}>{money(card.bundlePrice)}</span>
                {card.savingPercent > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--sf-color-accent,#B45309)_16%,white)] px-2 py-0.5 text-[11px] font-bold text-[var(--sf-color-accent,#B45309)]">
                    <BadgePercent className="size-3" />
                    توفير {card.savingPercent}%
                  </span>
                ) : null}
                {card.freeDelivery ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-color-surface-muted,#F3F7F6)] px-2 py-0.5 text-[11px] font-bold text-[var(--sf-color-text-muted,#576B66)]">
                    <Truck className="size-3" />
                    توصيل مجاني
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  setLocation(`/b/${card.slug}`);
                }}
                className={tone.button}
              >
                <ShoppingBag className="ml-1.5 inline size-4" />
                اطلب الآن
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  buy(card);
                }}
                className="mt-2 w-full rounded-full border border-[var(--sf-color-border,#E6EEEB)] py-2 text-[12px] font-bold text-[var(--sf-color-text-muted,#576B66)]"
              >
                أضف إلى السلة
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
