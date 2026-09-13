import Storefront from "@/pages/Storefront";
import { ModernStorefront } from "@/storefront/ModernStorefront";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

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

  if (query.data?.templateKey === "modern") {
    return (
      <ModernStorefront
        config={query.data.config}
        storeName={query.data.storeName || "المتجر"}
      />
    );
  }

  return <Storefront />;
}
