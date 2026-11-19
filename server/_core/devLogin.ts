import type { Express } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

/**
 * Local-only passwordless developer login.
 *
 * Fail-closed: enabled ONLY when NODE_ENV is exactly "development". Production,
 * staging, test runners and an unset NODE_ENV never register the route.
 */
export function isDevLoginEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv === "development";
}

export function registerDevLoginRoute(app: Express): void {
  if (!isDevLoginEnabled()) return;

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
    } catch (error) {
      console.error("DEV LOGIN ERROR", error);
      res.status(500).json({ error: String(error) });
    }
  });
}
