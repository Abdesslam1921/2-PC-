/**
 * Storefront version retention policy (Phase 6, item 2).
 *
 * This module is PURE: it only produces a plan (which versions to keep and
 * which are candidates for pruning). It never touches the database and never
 * deletes anything. Actual pruning must be an explicit, authorised and audited
 * operator step — there is no silent deletion.
 *
 * Policy (explicit):
 *  - The current PUBLISHED version is always protected.
 *  - The newest `minVersionsToKeep` versions are always protected (rollback
 *    floor), so history can never be emptied in one step.
 *  - At most `maxVersionsPerStore` versions are retained per store.
 *  - `maxAgeDays`, when set, is an additional safety floor: a version younger
 *    than the age cap is never pruned even if it exceeds the count cap
 *    (`null` = purely count-based, the default).
 *
 * Versions are identified by `versionNumber` within ONE store (immutable rows).
 */
export interface StorefrontVersionRef {
  versionNumber: number;
  publishedAt: Date | string;
}

export interface StorefrontRetentionPolicy {
  /** Maximum versions to retain per store (count cap). */
  maxVersionsPerStore: number;
  /** Absolute floor of newest versions that must never be pruned. */
  minVersionsToKeep: number;
  /**
   * Optional age cap in days. Versions newer than this are never pruned, even
   * when they exceed the count cap. `null` = count-based only.
   */
  maxAgeDays: number | null;
}

export const DEFAULT_STOREFRONT_RETENTION_POLICY: StorefrontRetentionPolicy = {
  maxVersionsPerStore: 200,
  minVersionsToKeep: 50,
  maxAgeDays: null,
};

export interface StorefrontRetentionPlan {
  policy: StorefrontRetentionPolicy;
  /** versionNumbers that must remain stored. */
  keep: number[];
  /** versionNumbers that are pruning candidates (never deleted silently). */
  prune: number[];
  /** versionNumbers that are always kept regardless of the count cap. */
  protectedVersions: number[];
  totalVersions: number;
}

const DAY_MS = 86_400_000;

function toMillis(value: Date | string): number {
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Compute a retention plan for one store's versions.
 *
 * Deterministic and side-effect free: callers may persist/act on it only
 * through an explicit, audited path.
 */
export function planStorefrontRetention(input: {
  versions: StorefrontVersionRef[];
  currentPublishedVersion: number | null;
  policy?: Partial<StorefrontRetentionPolicy>;
  now?: Date;
}): StorefrontRetentionPlan {
  const policy: StorefrontRetentionPolicy = {
    ...DEFAULT_STOREFRONT_RETENTION_POLICY,
    ...input.policy,
  };
  // The count cap can never drop below the rollback floor (or below 1).
  const cap = Math.max(policy.maxVersionsPerStore, policy.minVersionsToKeep, 1);
  const sorted = [...input.versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  const protectedSet = new Set<number>();
  if (input.currentPublishedVersion !== null) {
    protectedSet.add(input.currentPublishedVersion);
  }
  sorted
    .slice(0, Math.max(policy.minVersionsToKeep, 0))
    .forEach(version => protectedSet.add(version.versionNumber));

  const now = (input.now ?? new Date()).getTime();
  const ageFloorMs =
    policy.maxAgeDays === null ? null : Math.max(policy.maxAgeDays, 0) * DAY_MS;

  const keep: number[] = [];
  const prune: number[] = [];
  sorted.forEach((version, index) => {
    const withinCountCap = index < cap;
    const isProtected = protectedSet.has(version.versionNumber);
    const withinAgeFloor =
      ageFloorMs !== null && now - toMillis(version.publishedAt) <= ageFloorMs;
    if (withinCountCap || isProtected || withinAgeFloor) {
      keep.push(version.versionNumber);
    } else {
      prune.push(version.versionNumber);
    }
  });

  return {
    policy: { ...policy, maxVersionsPerStore: cap },
    keep,
    prune,
    protectedVersions: sorted
      .filter(version => protectedSet.has(version.versionNumber))
      .map(version => version.versionNumber),
    totalVersions: sorted.length,
  };
}
