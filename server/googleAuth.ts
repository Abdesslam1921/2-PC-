import { randomBytes } from "node:crypto";
import { parse as parseCookie } from "cookie";
import type { Express, Request } from "express";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionToken,
} from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

const STATE_COOKIE = "google_auth_state";
const SCOPES = ["openid", "email", "profile"].join(" ");

function redirectUri(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(
    ","
  )[0];
  return `${proto}://${req.get("host")}/api/google/auth/callback`;
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/google/auth/start", (req, res) => {
    if (!ENV.googleOAuthClientId || !ENV.googleOAuthClientSecret) {
      return res.status(503).send("إعدادات Google OAuth غير مكتملة.");
    }
    const nonce = randomBytes(24).toString("hex");
    const secure = getSessionCookieOptions(req).secure;
    res.cookie(STATE_COOKIE, nonce, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure,
      maxAge: 600_000,
    });
    const params = new URLSearchParams({
      client_id: ENV.googleOAuthClientId,
      redirect_uri: redirectUri(req),
      response_type: "code",
      scope: SCOPES,
      state: nonce,
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  app.get("/api/google/auth/callback", async (req, res) => {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    const cookieState = parseCookie(req.headers.cookie ?? "")[STATE_COOKIE];
    if (!code || !state || cookieState !== state) {
      return res.status(403).send("تعذر التحقق من جلسة Google OAuth.");
    }
    const secure = getSessionCookieOptions(req).secure;
    res.clearCookie(STATE_COOKIE, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure,
    });

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleOAuthClientId,
          client_secret: ENV.googleOAuthClientSecret,
          redirect_uri: redirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error("Google token exchange failed");
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token)
        throw new Error("Google did not return an access token");

      const profileRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );
      if (!profileRes.ok) throw new Error("Failed to load Google profile");
      const profile = (await profileRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      const email = profile.email?.trim().toLowerCase();
      if (!email) throw new Error("Google profile missing email");

      const db = await getDb();
      if (!db) return res.status(500).send("قاعدة البيانات غير متاحة حاليًا.");

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let openId: string;
      let name: string | null;

      if (existing) {
        openId = existing.openId;
        name = existing.name ?? profile.name ?? null;
        await db
          .update(users)
          .set({
            googleId: profile.sub ?? existing.googleId,
            avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
            name,
            lastSignedIn: new Date(),
          })
          .where(eq(users.id, existing.id));
      } else {
        openId = `google_${profile.sub ?? nanoid(24)}`;
        name = profile.name ?? null;
        await db.insert(users).values({
          openId,
          name,
          email,
          loginMethod: "google",
          googleId: profile.sub ?? null,
          avatarUrl: profile.picture ?? null,
          role: "user",
          lastSignedIn: new Date(),
        });
      }

      const token = await createSessionToken({ openId, email, name });
      res.cookie(SESSION_COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: SESSION_MAX_AGE_MS,
      });
      res.redirect("/");
    } catch (error) {
      console.warn("[Google Auth] callback failed", error);
      res.redirect("/login?google=error");
    }
  });
}
