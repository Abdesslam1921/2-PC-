import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { and, asc, eq } from "drizzle-orm";
import { stores, type Store } from "../../drizzle/schema";
import { getDb } from "../db";

export const ACTIVE_STORE_COOKIE = "active_store_id";

function baseDomain(): string {
  return (process.env.APP_BASE_DOMAIN || "abdou-store.com").toLowerCase();
}

export function getSlugFromHostname(hostname: string): string | null {
  const host = (hostname || "").split(":")[0].toLowerCase();
  const base = baseDomain();
  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === base ||
    host === `www.${base}`
  )
    return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(base.length + 1));
    if (sub && !sub.includes(".") && sub !== "www") return sub;
  }
  return null;
}

/**
 * Public storefront resolution: only ACTIVE stores are reachable by hostname.
 * An inactive store must not be served, indexed or listed in a sitemap. The
 * owner dashboard is unaffected because it resolves through
 * `getActiveStoreForUser` (owner-scoped), not through the request host.
 */
export async function resolveStoreBySlug(slug: string): Promise<Store | null> {
  const db = await getDb();
  if (!db) return null;
  const [store] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.slug, slug), eq(stores.isActive, true)))
    .limit(1);
  return store ?? null;
}

export async function resolveStoreByRequest(
  req: Request
): Promise<Store | null> {
  const slug = getSlugFromHostname(req.headers.host ?? "");
  if (!slug) return null;
  return resolveStoreBySlug(slug);
}

export async function listStoresForOwner(ownerId: number): Promise<Store[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(stores)
    .where(eq(stores.ownerId, ownerId))
    .orderBy(asc(stores.createdAt));
}

export async function createDefaultStoreForOwner(
  ownerId: number,
  name?: string | null,
  email?: string | null
): Promise<Store | null> {
  const db = await getDb();
  if (!db) return null;
  const sanitize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  let slug = sanitize((email ?? "").split("@")[0]) || `store-${ownerId}`;
  const [dup] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.slug, slug))
    .limit(1);
  if (dup)
    slug = `${slug}-${ownerId}-${Math.random().toString(36).slice(2, 8)}`;
  const [created] = await db
    .insert(stores)
    .values({
      ownerId,
      name: name || "متجري",
      slug,
      language: "dz-ar",
      isActive: true,
    });
  const id = Number(created?.insertId);
  if (!id) return null;
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, id))
    .limit(1);
  return store ?? null;
}

export async function getActiveStoreForUser(
  ownerId: number,
  req: Request
): Promise<Store | null> {
  const mine = await listStoresForOwner(ownerId);
  if (!mine.length) return createDefaultStoreForOwner(ownerId);
  const cookie = parseCookieHeader(req.headers.cookie ?? "")[
    ACTIVE_STORE_COOKIE
  ];
  if (cookie) {
    const wanted = Number(cookie);
    const match = mine.find(store => store.id === wanted);
    if (match) return match;
  }
  return mine[0];
}
