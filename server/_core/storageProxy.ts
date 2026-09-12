import type { Express } from "express";
import { ENV } from "./env";
import path from "path";
import fs from "fs";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) return res.status(400).send("Missing key");

    const tryPaths = [
      path.join(process.cwd(), "file_storage", key),
      path.join(process.cwd(), "file_storage", key.replace("/1/", "/")),
      path.join(
        process.cwd(),
        "file_storage",
        key.replace("products/1/", "products/")
      ),
    ];

    for (const p of tryPaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        console.log("[STORAGE] Serving:", p);
        return res.sendFile(p);
      }
    }

    console.log("[STORAGE] NOT FOUND:", key, "tried", tryPaths);

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
