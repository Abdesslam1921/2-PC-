import type { Request, Response } from "express";
import { syncAllStoresEcotrackStatuses } from "./ecotrackSync";
import { sdk } from "./_core/sdk";

/**
 * Cron entrypoint for the automatic Ecotrack status polling (spec §5).
 * Called by the in-process scheduler and/or the platform cron every 5 minutes.
 */
export async function handleForshipScheduledSync(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const summary = await syncAllStoresEcotrackStatuses();
    return res.json({ ok: true, ...summary, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "forship-sync-failed", timestamp: new Date().toISOString() });
  }
}
