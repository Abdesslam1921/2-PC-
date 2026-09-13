import Storefront from "@/pages/Storefront";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { MinimalStorefront } from "@/storefront/MinimalStorefront";
import { BoldStorefront } from "@/storefront/BoldStorefront";
import { BoutiqueStorefront } from "@/storefront/BoutiqueStorefront";
import { trpc } from "@/lib/trpc";
import { buildStorefrontTokenOverrides } from "@shared/storefront/themeRuntime";
import { templateDefaultTokens } from "@/storefront/themeDefaults";
import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Public storefront entry.
 *
 * Legacy coexistence: stores that never opted into the new template system
 * keep rendering the existing storefront. Only a store with a valid PUBLISHED
 * Modern config renders the Modern template.
 */
export default function StorePublic() {
  const query = trpc.storefront.publicConfig.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FFFCF6]">
        <Loader2 className="size-8 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  if (query.data) {
    const name = query.data.storeName || "المتجر";
    const themeStyle = {
      ...templateDefaultTokens(query.data.config.templateKey),
      ...buildStorefrontTokenOverrides(query.data.config.theme ?? {}),
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
        <div data-sf-root style={themeStyle}>
          {template}
        </div>
      );
    }
  }

  return <Storefront />;
}
