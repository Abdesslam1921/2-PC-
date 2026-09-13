/**
 * Persistence for the Storefront Template System (Phase 3).
 * All operations are scoped by storeId; the API layer enforces ownership.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  storefrontAuditLogs,
  storefrontDrafts,
  storefrontVersions,
  type StorefrontVersion,
} from "../drizzle/schema";

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

export async function saveStorefrontDraft(input: {
  ownerId: number;
  storeId: number;
  configJson: string;
  expectedVersion: number;
  updatedBy: number;
}): Promise<{ conflict: boolean; version?: number; currentVersion?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
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
    await db.insert(storefrontDrafts).values({
      ownerId: input.ownerId,
      storeId: input.storeId,
      configJson: input.configJson,
      concurrencyVersion: 1,
      updatedBy: input.updatedBy,
    });
    return { conflict: false, version: 1 };
  }

  if (existing.concurrencyVersion !== input.expectedVersion) {
    return { conflict: true, currentVersion: existing.concurrencyVersion };
  }
  const next = existing.concurrencyVersion + 1;
  await db
    .update(storefrontDrafts)
    .set({
      configJson: input.configJson,
      concurrencyVersion: next,
      updatedBy: input.updatedBy,
    })
    .where(eq(storefrontDrafts.storeId, input.storeId));
  return { conflict: false, version: next };
}

export async function createStorefrontVersion(input: {
  ownerId: number;
  storeId: number;
  snapshotJson: string;
  sourceDraftVersion: number | null;
  publishedBy: number;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [latest] = await db
    .select({ versionNumber: storefrontVersions.versionNumber })
    .from(storefrontVersions)
    .where(eq(storefrontVersions.storeId, input.storeId))
    .orderBy(desc(storefrontVersions.versionNumber))
    .limit(1);
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
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
