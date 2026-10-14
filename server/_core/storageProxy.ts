import type { Express } from "express";
import { ENV } from "./env";
import fs from "fs";
import {
  resolveWithinStorageRoot,
  sanitizeStorageKey,
} from "./storagePaths";
import { isProtectedStorageKey } from "./mediaSignature";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0] ?? "";
    // Reject path traversal / abs paths / over-encoding BEFORE touching disk.
    const key = sanitizeStorageKey(rawKey);
    if (!key) return res.status(400).send("Invalid key");

    // Paid digital files are never public: they are served only through the
    // token-gated /api/downloads/:token → /api/media flow. Answer 404 (not 403)
    // so the public proxy does not confirm that such a key exists.
    if (isProtectedStorageKey(key)) return res.status(404).send("Not found");

    // Legacy keys were stored under products/1/... — keep those working, but
    // every candidate is re-resolved inside the storage root.
    const candidateRelKeys = [
      key,
      key.replace("/1/", "/"),
      key.replace("products/1/", "products/"),
    ];
    for (const relKey of candidateRelKeys) {
      const absPath = resolveWithinStorageRoot(relKey);
      if (!absPath) continue;
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        return res.sendFile(absPath);
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      return res.status(404).send("Not found: " + key);
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      const { url } = (await forgeResp.json()) as { url: string };
      return res.redirect(307, url);
    } catch (e) {
      return res.status(502).send("Storage error");
    }
  });
}
