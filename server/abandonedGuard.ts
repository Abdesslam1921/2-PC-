import { checkRateLimit } from "./_core/rateLimit";
import {
  ALGERIAN_MOBILE_PATTERN,
  normalizeAlgerianMobile,
} from "./phone";

export { ALGERIAN_MOBILE_PATTERN };

/**
 * Windowing for the public abandoned-order endpoint. The PRIMARY limit is per
 * (phone + store): it targets the actual abuse (spamming one store's cart list)
 * without punishing legitimate customers. The per-IP limit is only a coarse
 * flood floor and is deliberately HIGH, because Algerian mobile carriers put
 * many customers behind shared (CGNAT) IPs — a low IP cap would silently drop
 * real abandoned carts.
 */
export const ABANDONED_RATE = {
  perIp: 3000,
  perPhoneStore: 10,
  windowMs: 10 * 60 * 1000,
} as const;

export type AbandonedAttempt = {
  customerPhone?: string;
  ip: string;
  storeId: number;
};

export type AbandonedAttemptResult =
  | { ok: true; phone: string }
  | { ok: false; reason: "no_phone" | "invalid_phone" | "rate_limited" };

/**
 * Decide whether a public `saveAbandoned` attempt may touch the DB. Enforced
 * server-side; the caller records the returned `phone` (already normalised).
 *  - per-IP flood floor (high, applied even to malformed input so bad payloads
 *    can't flood);
 *  - phone presence + normalisation + Algerian mobile format;
 *  - per (phone + store) cap (the real abuse limiter).
 */
export function evaluateAbandonedAttempt({
  customerPhone,
  ip,
  storeId,
}: AbandonedAttempt): AbandonedAttemptResult {
  const now = Date.now();
  if (
    !checkRateLimit(
      `sa:ip:${ip}`,
      ABANDONED_RATE.perIp,
      ABANDONED_RATE.windowMs,
      now
    )
  )
    return { ok: false, reason: "rate_limited" };

  const phone = normalizeAlgerianMobile(customerPhone);
  if (!customerPhone?.trim()) return { ok: false, reason: "no_phone" };
  if (!phone) return { ok: false, reason: "invalid_phone" };

  if (
    !checkRateLimit(
      `sa:phone:${phone}|${storeId}`,
      ABANDONED_RATE.perPhoneStore,
      ABANDONED_RATE.windowMs,
      now
    )
  )
    return { ok: false, reason: "rate_limited" };

  return { ok: true, phone };
}
