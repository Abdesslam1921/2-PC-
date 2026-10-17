/**
 * Server-side logging for storefront normalization drops (Phase 6, item 2).
 *
 * Normalization removes values the current contract no longer understands. It
 * is intentionally silent in the returned config, so this module makes each
 * drop visible with its key, section, and reason. It never logs the dropped
 * value itself (merchant content), only safe metadata.
 *
 * Duplicate signatures are suppressed in-memory: published snapshots are
 * immutable, so the same old field would otherwise flood the log on every
 * public storefront request. The cache is bounded and resets on restart.
 */
import type { StorefrontNormalizationDrop } from "../shared/storefront/normalization";

const MAX_CACHE_ENTRIES = 2000;
const logged = new Set<string>();

/** Test-only: clear the duplicate-suppression cache. */
export function resetStorefrontNormalizationLogCacheForTests(): void {
  logged.clear();
}

export function logStorefrontNormalization(
  context: string,
  storeId: number | null,
  drops: StorefrontNormalizationDrop[]
): void {
  for (const drop of drops) {
    const signature = [
      context,
      storeId ?? "-",
      drop.path,
      drop.key,
      drop.section ?? "-",
      drop.reason,
      drop.detail ?? "-",
    ].join("|");
    if (logged.has(signature)) continue;
    if (logged.size >= MAX_CACHE_ENTRIES) logged.clear();
    logged.add(signature);
    console.warn(
      "[storefront] normalization dropped value",
      JSON.stringify({
        context,
        storeId,
        path: drop.path,
        key: drop.key,
        section: drop.section,
        reason: drop.reason,
        ...(drop.detail ? { detail: drop.detail } : {}),
      })
    );
  }
}
