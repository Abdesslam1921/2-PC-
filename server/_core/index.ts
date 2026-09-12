import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerGoogleOAuthRoutes } from "../googleOAuth";
import { registerGoogleAuthRoutes } from "../googleAuth";
import { registerMetaOAuthRoutes } from "../metaOAuth";
import { consumeDigitalDownload } from "../db";
import { storageGetSignedUrl } from "../storage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleMetaAdsScheduledSync } from "../metaAdsScheduled";
import { handleForshipScheduledSync } from "../forshipScheduled";
import { handleCarrierWebhook } from "../forshipWebhook";
import { syncAllStoresEcotrackStatuses } from "../ecotrackSync";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import * as db from "../db";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { resolveStoreByRequest, getActiveStoreForUser } from "./stores";
import { parseFormData, uploadFileToStorage } from "../fileUpload";
import { resolveCallCenterOrderForMedia } from "../callCenterDb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Carrier webhook (ForShip) — registered before the JSON body parser so the
  // exact request bytes are available for HMAC signature verification.
  app.post(
    "/api/webhooks/carrier/:carrierId",
    express.raw({ type: "*/*", limit: "1mb" }),
    handleCarrierWebhook
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Resolve the store from the subdomain (storename.abdou-store.com) for
  // visitors, and stash it on res.locals so the tRPC context can scope
  // public storefront queries to the matching store.
  app.use((req, res, next) => {
    void resolveStoreByRequest(req)
      .then(store => {
        res.locals.store = store;
        next();
      })
      .catch(() => {
        res.locals.store = null;
        next();
      });
  });

  // DEV LOGIN - دخول مطور بلا Google
  app.get("/api/auth/dev-login", async (req, res) => {
    try {
      const openId = ENV.ownerOpenId || "dev_owner_001";
      await db.upsertUser({
        openId,
        name: "Dev Owner",
        email: "dev@localhost",
        loginMethod: "dev",
        lastSignedIn: new Date(),
      });
      const token = await sdk.createSessionToken(openId, {
        name: "Dev Owner",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect("/");
    } catch (e) {
      console.error("DEV LOGIN ERROR", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // File upload endpoint for WhatsApp media
  app.post("/api/upload-whatsapp-media", async (req, res) => {
    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.substring(7);
      const session = await sdk.verifySession(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid token" });
      }
      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      const store = await getActiveStoreForUser(user.id, req);
      if (!store) {
        return res.status(400).json({ error: "No store resolved for user" });
      }
      
      // Parse the form data
      const { fields, files } = await parseFormData(req);
      
      // Extract required fields
      const orderId = parseInt(fields.orderId as string);
      if (!orderId || orderId <= 0) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const fileField = files.file;
      if (!fileField) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Upload file to storage
      const result = await uploadFileToStorage(fileField, user.id, store.id, orderId);
      
      res.json({
        success: true,
        url: result.url,
        storageKey: result.storageKey
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Upload failed", details: (error as Error).message });
    }
  });

  // Agent-scoped WhatsApp media upload (call-center token, full access only)
  app.post("/api/upload-whatsapp-media-agent", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.substring(7);
      const { fields, files } = await parseFormData(req);
      const orderId = parseInt(fields.orderId as string, 10);
      if (!orderId || orderId <= 0) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      const context = await resolveCallCenterOrderForMedia(token, orderId);
      const fileField = files.file;
      if (!fileField) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const result = await uploadFileToStorage(
        fileField,
        context.agentId,
        context.storeId,
        orderId
      );
      res.json({
        success: true,
        url: result.url,
        storageKey: result.storageKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /صلاحية|الطلب غير موجود|جلسة/.test(message) ? 401 : 500;
      res.status(status).json({ error: message });
    }
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  registerMetaOAuthRoutes(app);
  app.post("/api/scheduled/metaAdsSync", handleMetaAdsScheduledSync);
  app.post("/api/scheduled/forshipSync", handleForshipScheduledSync);
  app.get("/api/downloads/:token", async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      if (!/^[a-f0-9]{64}$/.test(token))
        return res.status(400).json({ message: "رابط التنزيل غير صالح." });
      const download = await consumeDigitalDownload(token);
      const signedUrl = await storageGetSignedUrl(download.storageKey);
      return res.redirect(302, signedUrl);
    } catch (error) {
      return res
        .status(403)
        .json({
          message: error instanceof Error ? error.message : "تعذر بدء التنزيل.",
        });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

/**
 * In-process automatic Ecotrack status polling (spec §5). Runs on a 5-minute
 * interval and once shortly after boot, so tracking stays fresh without the
 * operator pressing "sync". Guarded against overlapping runs.
 */
function startEcotrackAutoSync() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await syncAllStoresEcotrackStatuses();
      if (summary.synced || summary.delivered || summary.returned || summary.cancelled) {
        console.log(`[ForShip] auto-sync: ${summary.synced} synced · ${summary.delivered} delivered · ${summary.returned} returned · ${summary.cancelled} cancelled`);
      }
    } catch (error) {
      console.warn("[ForShip] auto-sync failed:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  const initialDelay = Number(process.env.ECOTRACK_AUTO_SYNC_INITIAL_DELAY_MS ?? 15000);
  const intervalMs = Number(process.env.ECOTRACK_AUTO_SYNC_INTERVAL_MS ?? 5 * 60 * 1000);
  setTimeout(() => void run(), initialDelay);
  setInterval(() => void run(), intervalMs);
}

startEcotrackAutoSync();
startServer().catch(console.error);