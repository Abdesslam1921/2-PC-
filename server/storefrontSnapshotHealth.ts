/**
 * Published-snapshot health (Phase 6, item 2).
 *
 * Given a store's versions ordered newest-first, decide which snapshot the LIVE
 * storefront should serve:
 *   1. the newest PUBLISHED version whose config is valid after normalization,
 *   2. otherwise the newest valid EARLIER version (the "last good" rollback),
 *   3. only if no version at all is valid → the Modern default.
 *
 * Pure and read-only: it never writes and never deletes a version.
 */
import { validateStoredStorefrontConfig } from "../shared/storefront/storefrontConfig";
import type { StorefrontConfig } from "../shared/storefront/storefrontConfig";

export interface StorefrontVersionSnapshot {
  versionNumber: number;
  snapshotJson: string;
  publishedAt: Date | string;
}

export interface PublishedHealth {
  /** True when the NEWEST published version is itself valid. */
  ok: boolean;
  /** Newest published version number (may be the corrupt one). */
  latestVersionNumber: number | null;
  /** Version the live storefront actually renders (null → Modern default). */
  servedVersionNumber: number | null;
  /** True when `servedVersionNumber` is not the newest published version. */
  servedFallback: boolean;
  /** Validation failure message of the newest version when `ok` is false. */
  reason: string | null;
}

export interface EvaluatedPublished {
  /** Validated config to render, or null when nothing valid exists. */
  config: StorefrontConfig | null;
  /** The snapshot that config came from (null → Modern default). */
  servedVersion: StorefrontVersionSnapshot | null;
  health: PublishedHealth;
}

function parseSnapshot(json: string): unknown | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Evaluate newest-first version snapshots. `config === null` means the caller
 * must fall back to the Modern default (no version at all was valid).
 */
export function evaluatePublishedSnapshots(
  versionsNewestFirst: StorefrontVersionSnapshot[]
): EvaluatedPublished {
  const latest = versionsNewestFirst[0] ?? null;
  let servedIndex = -1;
  let servedData: StorefrontConfig | null = null;
  let firstReason: string | null = null;

  for (let index = 0; index < versionsNewestFirst.length; index += 1) {
    const version = versionsNewestFirst[index];
    const parsed = parseSnapshot(version.snapshotJson);
    if (parsed === null) {
      firstReason = firstReason ?? "JSON غير قابل للتحليل (corrupt)";
      continue;
    }
    const valid = validateStoredStorefrontConfig(parsed);
    if (valid.ok && valid.data) {
      servedIndex = index;
      servedData = valid.data;
      break;
    }
    firstReason = firstReason ?? valid.message ?? "إعداد غير صالح.";
  }

  const servedVersion = servedIndex >= 0 ? versionsNewestFirst[servedIndex] : null;
  const health: PublishedHealth = {
    ok: servedIndex === 0,
    latestVersionNumber: latest?.versionNumber ?? null,
    // null means the storefront renders the Modern default (nothing valid).
    servedVersionNumber: servedVersion?.versionNumber ?? null,
    // true when the newest published version is not what is being served
    // (an earlier version, or the Modern default when nothing is valid).
    servedFallback: servedIndex !== 0,
    reason: servedIndex === 0 ? null : firstReason,
  };

  if (!servedVersion || !servedData) {
    return { config: null, servedVersion: null, health };
  }
  return { config: servedData, servedVersion, health };
}
