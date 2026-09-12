import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { saveGoogleOAuthConnection } from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getActiveStoreForUser } from "./_core/stores";

const STATE_COOKIE = "__Host-google_oauth_state";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function redirectUri(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(
    ","
  )[0];
  return `${proto}://${req.get("host")}/api/google/oauth/callback`;
}

function sign(payload: string) {
  return createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest("base64url");
}

function makeState(
  ownerId: number,
  storeId: number,
  spreadsheetId: string,
  nonce: string
) {
  const payload = Buffer.from(
    JSON.stringify({
      ownerId,
      storeId,
      spreadsheetId,
      nonce,
      exp: Date.now() + 10 * 60_000,
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as {
      ownerId?: number;
      storeId?: number;
      spreadsheetId?: string;
      nonce?: string;
      exp?: number;
    };
    if (
      !decoded.ownerId ||
      !decoded.spreadsheetId ||
      !decoded.nonce ||
      !decoded.exp ||
      decoded.exp < Date.now()
    )
      return null;
    return decoded as {
      ownerId: number;
      storeId: number;
      spreadsheetId: string;
      nonce: string;
      exp: number;
    };
  } catch {
    return null;
  }
}

function setStateCookie(res: Response, value: string) {
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=${encodeURIComponent(value)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=None`
  );
}

function clearStateCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None`
  );
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/google/oauth/start", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const store = await getActiveStoreForUser(user.id, req);
      const spreadsheetId = String(req.query.spreadsheetId ?? "").trim();
      if (!spreadsheetId)
        return res.status(400).send("أدخل Spreadsheet ID قبل ربط Google.");
      if (!ENV.googleOAuthClientId || !ENV.googleOAuthClientSecret)
        return res.status(503).send("إعدادات Google OAuth غير مكتملة.");
      const nonce = randomBytes(24).toString("hex");
      const state = makeState(user.id, store?.id ?? 0, spreadsheetId, nonce);
      setStateCookie(res, state);
      const params = new URLSearchParams({
        client_id: ENV.googleOAuthClientId,
        redirect_uri: redirectUri(req),
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state,
      });
      return res.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      );
    } catch {
      return res.status(401).send("يجب تسجيل الدخول قبل ربط Google.");
    }
  });

  app.get("/api/google/oauth/callback", async (req, res) => {
    const code = String(req.query.code ?? "");
    const stateValue = String(req.query.state ?? "");
    const cookieState = parseCookie(req.headers.cookie ?? "")[STATE_COOKIE];
    const state = verifyState(stateValue);
    if (!code || !state || cookieState !== stateValue)
      return res.status(403).send("تعذر التحقق من جلسة Google OAuth.");
    clearStateCookie(res);
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
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
      if (!response.ok) throw new Error("Google token exchange failed");
      const tokens = (await response.json()) as {
        refresh_token?: string;
        access_token?: string;
      };
      if (!tokens.refresh_token)
        throw new Error("Google did not return a refresh token");
      let email: string | undefined;
      if (tokens.access_token) {
        const profile = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (profile.ok)
          email = ((await profile.json()) as { email?: string }).email;
      }
      await saveGoogleOAuthConnection(state.ownerId, state.storeId, {
        spreadsheetId: state.spreadsheetId,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        email,
      });
      return res.redirect("/connecteurs?google=connected");
    } catch (error) {
      console.warn("[Google OAuth] callback failed", error);
      return res.redirect("/connecteurs?google=error");
    }
  });
}
