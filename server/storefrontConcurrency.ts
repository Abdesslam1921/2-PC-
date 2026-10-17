/**
 * Stable concurrency signals for the storefront draft/version store.
 *
 * The DB helpers raise these instead of leaking driver errors (which would
 * become a generic 500). The router maps a version conflict to TRPC CONFLICT
 * with a clear Arabic message.
 */

export const STOREFRONT_VERSION_CONFLICT_CODE = "STOREFRONT_VERSION_CONFLICT";

export class StorefrontVersionConflictError extends Error {
  readonly code = STOREFRONT_VERSION_CONFLICT_CODE;

  constructor(
    message = "تعذّر إنشاء إصدار جديد بسبب نشر/تراجع متزامن. أعد المحاولة."
  ) {
    super(message);
    this.name = "StorefrontVersionConflictError";
  }
}

export function isStorefrontVersionConflict(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === STOREFRONT_VERSION_CONFLICT_CODE
  );
}

/**
 * MySQL duplicate-key error (unique constraint), as surfaced by mysql2.
 *
 * Drizzle wraps driver errors in a `DrizzleQueryError`, so the driver `code`
 * may live in `cause` (possibly nested). Walk the cause chain (bounded).
 */
export function isDuplicateKeyError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const code = (error as { code?: unknown }).code;
  const errno = (error as { errno?: unknown }).errno;
  if (code === "ER_DUP_ENTRY" || errno === 1062) return true;
  const cause = (error as { cause?: unknown }).cause;
  if (cause && cause !== error) {
    return isDuplicateKeyError(cause, depth + 1);
  }
  return false;
}
