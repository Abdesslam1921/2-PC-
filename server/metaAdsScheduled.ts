import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { metaAdAccounts } from "../drizzle/schema";
import { getDb } from "./db";
import { syncMetaAdAccount } from "./metaAdsSync";
import { sdk } from "./_core/sdk";

export async function handleMetaAdsScheduledSync(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid)
      return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    const [account] = await db
      .select()
      .from(metaAdAccounts)
      .where(eq(metaAdAccounts.scheduleCronTaskUid, user.taskUid))
      .limit(1);
    if (!account) return res.json({ ok: true, skipped: "orphan" });
    const dateStop = new Date().toISOString().slice(0, 10);
    const dateStart = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const result = await syncMetaAdAccount(
      account.ownerId,
      account.id,
      dateStart,
      dateStop
    );
    await db
      .update(metaAdAccounts)
      .set({ status: "connected", lastSyncedAt: new Date(), lastError: null })
      .where(
        and(
          eq(metaAdAccounts.id, account.id),
          eq(metaAdAccounts.scheduleCronTaskUid, user.taskUid)
        )
      );
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "meta-sync-failed",
        timestamp: new Date().toISOString(),
      });
  }
}
