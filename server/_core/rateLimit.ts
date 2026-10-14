/**
 * Tiny in-process fixed-window rate limiter for public, unauthenticated
 * endpoints (no external store / Redis is introduced). Keys are caller-defined
 * strings; counters reset when their window elapses.
 *
 * This is best-effort abuse protection for a single process: it is not a
 * distributed limiter, so it complements (never replaces) edge/WAF limits.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const key of Array.from(buckets.keys())) {
    const window = buckets.get(key);
    if (window && window.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Register one attempt against `key`. Returns `true` while under `limit` within
 * the current `windowMs`, and `false` once the limit is exceeded.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  prune(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Test helper: clear all counters. */
export function resetRateLimits() {
  buckets.clear();
}
