import type { Express } from "express";
import fs from "fs";
import {
  isProtectedStorageKey,
  verifyMediaSignature,
} from "./mediaSignature";
import { resolveWithinStorageRoot, sanitizeStorageKey } from "./storagePaths";

/**
 * Local-mode delivery of protected (paid) digital files.
 *
 * Only `digital-products/` keys are served here, and only when the request
 * carries a valid unexpired HMAC signature. The public `/manus-storage/*` proxy
 * refuses the same prefix, so a paid file is reachable exclusively through
 * `/api/downloads/:token` → (redirect) → `/api/media?...`.
 */
export function registerDigitalMediaRoute(app: Express) {
  app.get("/api/media", (req, res) => {
    const rawKey = String(req.query.key ?? "");
    const key = sanitizeStorageKey(rawKey);
    if (!key || !isProtectedStorageKey(key))
      return res.status(403).send("Forbidden");

    if (!verifyMediaSignature(key, req.query.exp, req.query.sig))
      return res.status(403).send("Expired or invalid link");

    const absPath = resolveWithinStorageRoot(key);
    if (!absPath || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile())
      return res.status(404).send("Not found");

    return res.sendFile(absPath);
  });
}
