import { checkRateLimit } from "./_core/rateLimit";

/** Algerian mobile numbers: 05/06/07 + 8 digits. */
export const ABANDONED_PHONE_PATTERN = /^0[567][0-9]{8}$/;

/** Windowing for the public abandoned-order endpoint. */
export const ABANDONED_RATE = {
  perIp: 60,
  perTriple: 10,
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
 * server-side (the client already strips non-digits and caps the length):
 *  - per-IP cap, applied even to malformed input so bad payloads can't flood;
 *  - phone presence + Algerian mobile format;
 *  - per (IP + phone + store) cap.
 */
export function evaluateAbandonedAttempt({
  customerPhone,
  ip,
  storeId,
}: AbandonedAttempt): AbandonedAttemptResult {
  const now = Date.now();
  if (!checkRateLimit(`sa:ip:${ip}`, ABANDONED_RATE.perIp, ABANDONED_RATE.windowMs, now))
    return { ok: false, reason: "rate_limited" };

  const phone = (customerPhone ?? "").trim();
  if (!phone) return { ok: false, reason: "no_phone" };
  if (!ABANDONED_PHONE_PATTERN.test(phone))
    return { ok: false, reason: "invalid_phone" };

  if (
    !checkRateLimit(
      `sa:triple:${ip}|${phone}|${storeId}`,
      ABANDONED_RATE.perTriple,
      ABANDONED_RATE.windowMs,
      now
    )
  )
    return { ok: false, reason: "rate_limited" };

  return { ok: true };
}
