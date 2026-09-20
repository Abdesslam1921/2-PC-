import {
  Banknote,
  Check,
  Clock,
  Gift,
  Heart,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

/** Approved icon keys (see ICON_OPTIONS in sectionFields) → real components. */
const ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  banknote: Banknote,
  shield: ShieldCheck,
  return: RotateCcw,
  phone: Phone,
  star: Star,
  heart: Heart,
  gift: Gift,
  check: Check,
  clock: Clock,
  sparkles: Sparkles,
};

export function sectionIcon(key: string | undefined, fallback: LucideIcon) {
  return (key && ICONS[key]) || fallback;
}

/**
 * Anchors used by footer links. Section ids are merchant-editable, so the
 * target is resolved from the config: the first enabled products section and
 * the first enabled categories section, otherwise the storefront root.
 */
export function storefrontAnchors(config: StorefrontConfig) {
  const enabled = [...config.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);
  const products =
    enabled.find(s => s.type === "product_grid") ??
    enabled.find(s => s.type === "featured_products");
  const categories = enabled.find(s => s.type === "categories");
  return {
    products: products ? `#sf-sec-${products.id}` : "#top",
    categories: categories ? `#sf-sec-${categories.id}` : "#top",
    hasCategories: Boolean(categories),
  };
}
