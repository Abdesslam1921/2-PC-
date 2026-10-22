import type { Store } from "../drizzle/schema";

/**
 * Trusted absolute origins.
 *
 * Public links (canonical, Open Graph, sitemap, email/WhatsApp/download links)
 * are built from configuration and the store slug — never from the request
 * `Host` or `X-Forwarded-Proto` headers, which any client can spoof.
 */

const DEFAULT_BASE_DOMAIN = "abdou-store.com";
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/** `APP_BASE_DOMAIN` normalised to a safe host (scheme/path stripped). */
export function appBaseDomain(): string {
  const raw = (process.env.APP_BASE_DOMAIN || DEFAULT_BASE_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "");
  return HOST_PATTERN.test(raw) && raw.includes(".") ? raw : DEFAULT_BASE_DOMAIN;
}

/** The SaaS marketing/admin origin (no store subdomain). */
export function mainSiteOrigin(): string {
  return `https://${appBaseDomain()}`;
}

/** Store slugs are lowercase `[a-z0-9-]`; anything else is not linkable. */
export function normalizeStoreSlug(
  slug: string | null | undefined
): string | null {
  const value = (slug ?? "").trim().toLowerCase();
  return SLUG_PATTERN.test(value) ? value : null;
}

/** `https://<slug>.<APP_BASE_DOMAIN>` or `null` when the slug is invalid. */
export function storeOrigin(
  store: Pick<Store, "slug"> | { slug?: string | null } | null | undefined
): string | null {
  const slug = normalizeStoreSlug(store?.slug);
  return slug ? `https://${slug}.${appBaseDomain()}` : null;
}

/** Store origin with a safe marketing-site fallback. */
export function publicOriginForStore(
  store: Pick<Store, "slug"> | { slug?: string | null } | null | undefined
): string {
  return storeOrigin(store) ?? mainSiteOrigin();
}
