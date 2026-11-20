/**
 * Short-lived, per-store cache for `storefront.publicConfig`.
 *
 * The published snapshot only changes when the merchant publishes or rolls
 * back, so both actions invalidate the entry explicitly (same instance). The
 * TTL is a safety net for other instances and for read-time additions such as
 * a newly created bundle. Keyed by storeId — never shared across tenants.
 */
type CacheEntry<T> = { expiresAt: number; value: T };

const DEFAULT_TTL_MS = 15_000;
const MAX_ENTRIES = 500;
const entries = new Map<number, CacheEntry<unknown>>();

function prune(now: number): void {
  entries.forEach((entry, key) => {
    if (entry.expiresAt <= now) entries.delete(key);
  });
  // Still oversized (many live stores): drop the oldest insertions.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function getCachedPublicConfig<T>(storeId: number): T | undefined {
  const now = Date.now();
  const entry = entries.get(storeId);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries.delete(storeId);
    return undefined;
  }
  return entry.value as T;
}

export function setCachedPublicConfig<T>(
  storeId: number,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const now = Date.now();
  prune(now);
  entries.set(storeId, { expiresAt: now + Math.max(1, ttlMs), value });
}

export function invalidatePublicConfig(storeId?: number): void {
  if (storeId === undefined) {
    entries.clear();
    return;
  }
  entries.delete(storeId);
}

/** Test helper. */
export function publicConfigCacheSize(): number {
  return entries.size;
}
