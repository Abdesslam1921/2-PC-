import crypto from "crypto";
import { ENV } from "./env";

/**
 * Signed, expiring URLs for protected (paid) storage keys in local mode, where
 * no external presigning service (Forge/S3) is configured.
 *
 * Digital product files live under the `digital-products/` prefix and must NEVER
 * be served by the public `/manus-storage/*` proxy. They are only reachable
 * through `/api/downloads/:token` (which consumes a one-time DB token) and then,
 * in local mode, through `/api/media?...` with an HMAC signature + `exp`.
 *
 * The signing key is derived from the app secret with a distinct label so it is
 * domain-separated from session/JWT signing.
 */
export const PROTECTED_STORAGE_PREFIX = "digital-products/";

/** How long a signed local media URL stays valid (the download link itself is
 *  still governed by the DB token's own expiry + max-downloads). */
export const MEDIA_URL_TTL_MS = 5 * 60 * 1000;

export function isProtectedStorageKey(key: string): boolean {
  return key.startsWith(PROTECTED_STORAGE_PREFIX);
}

function mediaSecret(): string {
  const base = ENV.cookieSecret || "abdou-store-media-local-secret";
  return crypto
    .createHmac("sha256", base)
    .update("local-media-sign-v1")
    .digest("hex");
}

function computeSignature(key: string, expSeconds: number): string {
  return crypto
    .createHmac("sha256", mediaSecret())
    .update(`${expSeconds}\n${key}`)
    .digest("hex");
}

/**
 * Build a signed local media URL for a protected key. Returns `/api/media?...`.
 * Only the (already normalised) key, an expiry and the signature travel in the
 * URL; nothing else is trusted.
 */
export function signMediaUrl(
  key: string,
  ttlMs: number = MEDIA_URL_TTL_MS,
  now: number = Date.now()
): string {
  const exp = Math.floor((now + ttlMs) / 1000);
  const sig = computeSignature(key, exp);
  const params = new URLSearchParams({ key, exp: String(exp), sig });
  return `/api/media?${params.toString()}`;
}

/**
 * Verify a signed local media request. Rejects when the expiry is missing/past
 * or the signature does not match (constant-time comparison).
 */
export function verifyMediaSignature(
  key: string,
  exp: unknown,
  sig: unknown,
  now: number = Date.now()
): boolean {
  const expSeconds = Number(exp);
  if (!Number.isFinite(expSeconds) || expSeconds <= 0) return false;
  if (expSeconds * 1000 < now) return false;
  if (typeof sig !== "string") return false;
  const expected = computeSignature(key, expSeconds);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(sig, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
