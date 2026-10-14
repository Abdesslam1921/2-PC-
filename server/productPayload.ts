/**
 * Product payload sanitisation for API responses.
 *
 * The raw storage reference of a paid digital file (`digitalFileStorageKey`)
 * and its storage URL (`digitalFileUrl`, e.g. `/manus-storage/digital-products/…`)
 * must NEVER leave the server through an API response. Clients only ever get the
 * token-gated `/api/downloads/:token` links; the raw refs stay server-internal
 * (used by the download flow and by update/duplicate).
 */
export function withoutDigitalFileRefs<
  T extends { digitalFileStorageKey?: unknown; digitalFileUrl?: unknown },
>(product: T): Omit<T, "digitalFileStorageKey" | "digitalFileUrl"> {
  const { digitalFileStorageKey: _key, digitalFileUrl: _url, ...safe } =
    product;
  return safe;
}
