import { checkRateLimit } from "./_core/rateLimit";

/** Algerian mobile numbers: 05/06/07 + 8 digits. */
export const ABANDONED_PHONE_PATTERN = /^0[567][0-9]{8}$/;

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
  | { ok: true }
  | { ok: false; reason: "no_phone" | "invalid_phone" | "rate_limited" };

/**
 * Decide whether a public `saveAbandoned` attempt may touch the DB. Enforced
 * server-side:
 *  - per-IP flood floor (high, applied even to malformed input so bad payloads
 *    can't flood);
 *  - phone presence + Algerian mobile format;
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

  const phone = (customerPhone ?? "").trim();
  if (!phone) return { ok: false, reason: "no_phone" };
  if (!ABANDONED_PHONE_PATTERN.test(phone))
    return { ok: false, reason: "invalid_phone" };

  if (
    !checkRateLimit(
      `sa:phone:${phone}|${storeId}`,
      ABANDONED_RATE.perPhoneStore,
      ABANDONED_RATE.windowMs,
      now
    )
  )
    return { ok: false, reason: "rate_limited" };

  return { ok: true };
}
