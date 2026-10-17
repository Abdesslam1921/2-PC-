/**
 * Observability for the STORED-config normalization layer.
 *
 * Normalization deliberately drops values the current contract no longer
 * understands. That is safe for rendering, but silent drops can hide real data
 * errors, so every dropped value is reported here with:
 *   - the exact path/key that was dropped,
 *   - the section (id/type) or "theme" it belongs to,
 *   - a stable machine-readable reason (plus optional safe detail).
 *
 * The value itself is never included, so merchant content never leaks to logs.
 */

export type StorefrontNormalizationReason =
  | "unknown-section-key"
  | "unknown-section-type"
  | "invalid-section-entry"
  | "invalid-setting-key"
  | "non-primitive-setting-value"
  | "invalid-setting-value"
  | "invalid-item-entry"
  | "unknown-item-key"
  | "unknown-theme-group"
  | "invalid-theme-group"
  | "invalid-theme-payload"
  | "unknown-theme-token"
  | "invalid-theme-value";

export interface StorefrontNormalizationDrop {
  /** Dotted/indexed location in the stored config (e.g. sections[2].settings.x). */
  path: string;
  /** The dropped key. */
  key: string;
  /** Section id/type when the drop is section-scoped, "theme" for theme drops. */
  section: string | null;
  reason: StorefrontNormalizationReason;
  /** Safe context only (never the dropped value itself). */
  detail?: string;
}

export type StorefrontNormalizationReport = StorefrontNormalizationDrop[];

/** Append a drop to an optional report. No-op when the caller does not collect. */
export function recordNormalizationDrop(
  report: StorefrontNormalizationReport | undefined,
  drop: StorefrontNormalizationDrop
): void {
  report?.push(drop);
}
