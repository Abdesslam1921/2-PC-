import { trpc } from "@/lib/trpc";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Public storefront entry.
 *
 * Legacy coexistence: stores that never opted into the new template system
 * keep rendering the existing storefront. Only a store with a valid PUBLISHED
 * config renders a template. Each template is lazy-loaded so a visit ships
 * only the active template's chunk, never all four.
 */
const Storefront = lazy(() => import("@/pages/Storefront"));
const ModernStorefront = lazy(() =>
  import("@/storefront/ModernStorefront").then(module => ({
    default: module.ModernStorefront,
  }))
);
const MinimalStorefront = lazy(() =>
  import("@/storefront/MinimalStorefront").then(module => ({
    default: module.MinimalStorefront,
  }))
);
const BoldStorefront = lazy(() =>
  import("@/storefront/BoldStorefront").then(module => ({
    default: module.BoldStorefront,
  }))
);
const BoutiqueStorefront = lazy(() =>
  import("@/storefront/BoutiqueStorefront").then(module => ({
    default: module.BoutiqueStorefront,
  }))
);

function StorefrontFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FFFCF6]">
      <Loader2 className="size-8 animate-spin text-[#0F766E]" />
    </div>
  );
}

export default function StorePublic() {
  const query = trpc.storefront.publicConfig.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) return <StorefrontFallback />;

  if (query.data) {
    const name = query.data.storeName || "المتجر";
    const themeStyle = {
      ...templateDefaultTokens(query.data.config.templateKey),
      ...buildStorefrontTokenOverrides(query.data.config.theme ?? {}),
      // Applies the theme heading font; `revert-layer` keeps the template font
      // unchanged when the merchant set no font token.
      fontFamily: "var(--sf-font-heading, revert-layer)",
    } as CSSProperties;

    let template = null;
    if (query.data.templateKey === "minimal") {
      template = <MinimalStorefront config={query.data.config} storeName={name} />;
    } else if (query.data.templateKey === "bold") {
      template = <BoldStorefront config={query.data.config} storeName={name} />;
    } else if (query.data.templateKey === "boutique") {
      template = <BoutiqueStorefront config={query.data.config} storeName={name} />;
    } else if (query.data.templateKey === "modern") {
      template = <ModernStorefront config={query.data.config} storeName={name} />;
    }

    if (template) {
      return (
        <Suspense fallback={<StorefrontFallback />}>
          <div data-sf-root style={themeStyle}>
            {template}
          </div>
        </Suspense>
      );
    }
  }

  return (
    <Suspense fallback={<StorefrontFallback />}>
      <Storefront />
    </Suspense>
  );
}
