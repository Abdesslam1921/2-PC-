import type { Request, Response } from "express";
import { processIncomingWebhook } from "./forship";

/**
 * Incoming carrier webhook (spec §3). Registered with express.raw so the exact
 * request bytes are available for signature verification, then responds 200
 * quickly once the update has been dispatched.
 */
export async function handleCarrierWebhook(req: Request, res: Response) {
  const carrierId = Number.parseInt(String(req.params.carrierId ?? ""), 10);
  if (!Number.isInteger(carrierId) || carrierId <= 0)
    return res.status(400).json({ message: "invalid carrier id" });

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {});
  const headers = req.headers as Record<string, string | string[] | undefined>;

  try {
    const result = await processIncomingWebhook(carrierId, rawBody, headers);
    return res.status(result.status).json({ message: result.message });
  } catch (error) {
    return res
      .status(200)
      .json({
        message: error instanceof Error ? error.message : "webhook error",
      });
  }
}
