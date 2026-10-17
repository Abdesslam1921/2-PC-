/**
 * Persistence for the Storefront Template System (Phase 3).
 * All operations are scoped by storeId; the API layer enforces ownership.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  StorefrontVersionConflictError,
  isDuplicateKeyError,
} from "./storefrontConcurrency";
import {
  storefrontAuditLogs,
  storefrontDrafts,
  storefrontVersions,
  type StorefrontVersion,
} from "../drizzle/schema";

/** The drizzle handle used by the app, injectable for live concurrency checks. */
export type StorefrontDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function affectedRows(result: unknown): number {
  return Number(
    (result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0
  );
}

export async function getStorefrontDraft(storeId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(storefrontDrafts)
    .where(eq(storefrontDrafts.storeId, storeId))
    .limit(1);
  return row ?? null;
}

export async function getPublishedStorefront(storeId: number): Promise<{
  versionNumber: number;
  snapshotJson: string;
  publishedAt: Date;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      versionNumber: storefrontVersions.versionNumber,
      snapshotJson: storefrontVersions.snapshotJson,
      publishedAt: storefrontVersions.publishedAt,
    })
    .from(storefrontVersions)
    .where(eq(storefrontVersions.storeId, storeId))
    .orderBy(desc(storefrontVersions.versionNumber))
    .limit(1);
  return row ?? null;
}

/**
 * Newest-first snapshots with their raw JSON, used to resolve the live config:
 * if the newest published snapshot is corrupt, the storefront still serves the
 * newest EARLIER valid version instead of going down.
 */
export async function listStorefrontVersionSnapshots(
  storeId: number,
  limit = 100
): Promise<Array<{ versionNumber: number; snapshotJson: string; publishedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      versionNumber: storefrontVersions.versionNumber,
      snapshotJson: storefrontVersions.snapshotJson,
      publishedAt: storefrontVersions.publishedAt,
    })
    .from(storefrontVersions)
    .where(eq(storefrontVersions.storeId, storeId))
    .orderBy(desc(storefrontVersions.versionNumber))
    .limit(limit);
}

export async function listStorefrontVersions(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: storefrontVersions.id,
      versionNumber: storefrontVersions.versionNumber,
      note: storefrontVersions.note,
      publishedBy: storefrontVersions.publishedBy,
      publishedAt: storefrontVersions.publishedAt,
    })
    .from(storefrontVersions)
    .where(eq(storefrontVersions.storeId, storeId))
    .orderBy(desc(storefrontVersions.versionNumber));
}

export async function getStorefrontVersionByNumber(
  storeId: number,
  versionNumber: number
): Promise<StorefrontVersion | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(storefrontVersions)
    .where(
      and(
        eq(storefrontVersions.storeId, storeId),
        eq(storefrontVersions.versionNumber, versionNumber)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function saveStorefrontDraft(
  input: {
    ownerId: number;
    storeId: number;
    configJson: string;
    expectedVersion: number;
    updatedBy: number;
  },
  executor?: StorefrontDb
): Promise<{ conflict: boolean; version?: number; currentVersion?: number }> {
  const db = executor ?? (await getDb());
  if (!db) throw new Error("Database unavailable");

  const readCurrentVersion = async (): Promise<number | null> => {
    const [row] = await db
      .select({ concurrencyVersion: storefrontDrafts.concurrencyVersion })
      .from(storefrontDrafts)
      .where(eq(storefrontDrafts.storeId, input.storeId))
      .limit(1);
    return row?.concurrencyVersion ?? null;
  };

  const [existing] = await db
    .select()
    .from(storefrontDrafts)
    .where(eq(storefrontDrafts.storeId, input.storeId))
    .limit(1);

  if (!existing) {
    // Optimistic concurrency: a new draft is version 1; clients must send 0.
    if (input.expectedVersion !== 0) {
      return { conflict: true, currentVersion: 0 };
    }
    try {
      await db.insert(storefrontDrafts).values({
        ownerId: input.ownerId,
        storeId: input.storeId,
        configJson: input.configJson,
        concurrencyVersion: 1,
        updatedBy: input.updatedBy,
      });
      return { conflict: false, version: 1 };
    } catch (error) {
      // Two first saves raced: the unique(storeId) index lets exactly one win.
      if (!isDuplicateKeyError(error)) throw error;
      return {
        conflict: true,
        currentVersion: (await readCurrentVersion()) ?? 1,
      };
    }
  }

  if (existing.concurrencyVersion !== input.expectedVersion) {
    return { conflict: true, currentVersion: existing.concurrencyVersion };
  }

  /**
   * The compare-and-swap MUST be part of the UPDATE predicate. Checking the
   * version with a separate SELECT would be a TOCTOU race: two tabs could both
   * read v5 and both write v6 (silent last-write-wins).
   */
  const next = input.expectedVersion + 1;
  const update = await db
    .update(storefrontDrafts)
    .set({
      configJson: input.configJson,
      concurrencyVersion: next,
      updatedBy: input.updatedBy,
    })
    .where(
      and(
        eq(storefrontDrafts.storeId, input.storeId),
        eq(storefrontDrafts.concurrencyVersion, input.expectedVersion)
      )
    );

  if (affectedRows(update) !== 1) {
    // Another save committed after our read: report the real current version
    // and write nothing on top of it.
    return {
      conflict: true,
      currentVersion:
        (await readCurrentVersion()) ?? existing.concurrencyVersion,
    };
  }
  return { conflict: false, version: next };
}

const MAX_VERSION_INSERT_ATTEMPTS = 5;

/**
 * Append an immutable published version.
 *
 * Version numbers are per store and UNIQUE(storeId, versionNumber). Two
 * concurrent publishes/rollbacks can read the same "latest" and race to insert
 * the same number; the loser retries against the now-higher latest instead of
 * returning a 500. After a bounded number of attempts it raises a typed
 * conflict, which the router maps to TRPC CONFLICT.
 */
export async function createStorefrontVersion(
  input: {
    ownerId: number;
    storeId: number;
    snapshotJson: string;
    sourceDraftVersion: number | null;
    publishedBy: number;
    note?: string | null;
  },
  executor?: StorefrontDb
) {
  const db = executor ?? (await getDb());
  if (!db) throw new Error("Database unavailable");

  for (let attempt = 0; attempt < MAX_VERSION_INSERT_ATTEMPTS; attempt += 1) {
    const [latest] = await db
      .select({ versionNumber: storefrontVersions.versionNumber })
      .from(storefrontVersions)
      .where(eq(storefrontVersions.storeId, input.storeId))
      .orderBy(desc(storefrontVersions.versionNumber))
      .limit(1);
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    try {
      await db.insert(storefrontVersions).values({
        ownerId: input.ownerId,
        storeId: input.storeId,
        versionNumber,
        snapshotJson: input.snapshotJson,
        sourceDraftVersion: input.sourceDraftVersion,
        publishedBy: input.publishedBy,
        note: input.note ?? null,
      });
      return { versionNumber };
    } catch (error) {
      // A concurrent writer took this number: retry with the new latest.
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  throw new StorefrontVersionConflictError();
}

export async function recordStorefrontAuditLog(input: {
  storeId: number;
  actorId: number;
  actorRole: string;
  isOverride?: boolean;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  fromVersion?: number | null;
  toVersion?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadataJson?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(storefrontAuditLogs).values({
    storeId: input.storeId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    isOverride: input.isOverride ?? false,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    fromVersion: input.fromVersion ?? null,
    toVersion: input.toVersion ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadataJson: input.metadataJson ?? null,
  });
}
