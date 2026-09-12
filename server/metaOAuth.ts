import crypto from "node:crypto";
import type { Express, Request } from "express";
import { eq, lt } from "drizzle-orm";
import { metaAdAccounts, metaOAuthStates } from "../drizzle/schema";
import { getDb } from "./db";
import { decryptSecret, encryptSecret } from "./secureSecrets";
import { saveMetaAdAccount } from "./profitabilityDb";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const META_AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
// Request only the two permissions needed for ad-account discovery and campaign
// management. Business, catalog, Pages, and Instagram permissions are optional
// and must not block the first connection or a later reconnect.
const SCOPES = ["ads_read", "ads_management"].join(",");

function base64url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function redirectUri(req: Request) {
  if (process.env.META_OAUTH_REDIRECT_URI)
    return process.env.META_OAUTH_REDIRECT_URI;
  const proto = String(
    req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http")
  ).split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host);
  return `${proto}://${host}/api/meta/oauth/callback`;
}

export async function createMetaOAuthUrl(
  ownerId: number,
  storeId: number,
  req: Request
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const clientId = process.env.META_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("لم يتم إعداد META_OAUTH_CLIENT_ID بعد.");
  await db
    .delete(metaOAuthStates)
    .where(lt(metaOAuthStates.expiresAt, new Date()));
  const state = base64url(crypto.randomBytes(32));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest()
  );
  const uri = redirectUri(req);
  await db
    .insert(metaOAuthStates)
    .values({
      ownerId,
      storeId,
      stateHash: hash(state),
      codeVerifierEncrypted: encryptSecret(verifier),
      redirectUri: uri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  const url = new URL(META_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", uri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", SCOPES);
  return { url: url.toString(), expiresInSeconds: 600 };
}

async function exchangeCode(code: string, verifier: string, uri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_OAUTH_CLIENT_ID || "",
    client_secret: process.env.META_OAUTH_CLIENT_SECRET || "",
    redirect_uri: uri,
    code,
    code_verifier: verifier,
  });
  const response = await fetch(
    `${GRAPH_URL}/oauth/access_token?${params.toString()}`
  );
  const body = (await response.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.access_token)
    throw new Error(body.error?.message || "تعذر إكمال مصادقة Meta.");
  return body.access_token;
}

async function fetchAdAccounts(accessToken: string) {
  const url = new URL(`${GRAPH_URL}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,account_currency");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    data?: Array<{ id?: string; name?: string; account_currency?: string }>;
    error?: { message?: string };
  };
  if (!response.ok || body.error)
    throw new Error(
      body.error?.message || "تعذر قراءة حسابات Meta المصرح بها."
    );
  return body.data || [];
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>\"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#39;",
      })[character] || character
  );
}
function oauthResultPage(title: string, message: string, success: boolean) {
  const color = success ? "#15803d" : "#b42318";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f8f7ff;font-family:Arial,sans-serif;color:#202238;display:grid;place-items:center;min-height:100vh;padding:20px}.card{width:min(520px,100%);box-sizing:border-box;background:#fff;border:1px solid #e7e3f0;border-radius:24px;padding:28px;box-shadow:0 20px 60px #352f6414;text-align:center}h1{font-size:22px;margin:0 0 14px;color:${color}}p{line-height:1.9;color:#666a7d;margin:0 0 22px}a{display:inline-block;background:#6d5ce7;color:#fff;text-decoration:none;border-radius:12px;padding:12px 20px;font-weight:700}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/media-buying">العودة إلى AI Media Buying</a></main>${success ? "<script>setTimeout(function(){location.replace('/media-buying?meta=connected')},1200)</script>" : ""}</body></html>`;
}
function sendOAuthResult(
  res: { status: (code: number) => { send: (body: string) => void } },
  code: number,
  title: string,
  message: string,
  success = false
) {
  return res.status(code).send(oauthResultPage(title, message, success));
}
export async function handleMetaOAuthCallback(
  req: Request,
  res: {
    redirect: (url: string) => void;
    status: (code: number) => { send: (body: string) => void };
  }
) {
  const state = String(req.query.state || "");
  const code = String(req.query.code || "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(state))
    return sendOAuthResult(
      res,
      400,
      "تعذر ربط Meta",
      "رابط مصادقة Meta غير صالح."
    );
  if (!code)
    return sendOAuthResult(
      res,
      400,
      "لم يتم ربط Meta",
      "لم تتم الموافقة على ربط Meta أو أُغلقت نافذة Facebook."
    );
  const db = await getDb();
  if (!db)
    return sendOAuthResult(
      res,
      503,
      "تعذر ربط Meta",
      "قاعدة البيانات غير متاحة حاليًا. أعد المحاولة بعد قليل."
    );
  const [session] = await db
    .select()
    .from(metaOAuthStates)
    .where(eq(metaOAuthStates.stateHash, hash(state)))
    .limit(1);
  if (!session || session.expiresAt.getTime() < Date.now())
    return sendOAuthResult(
      res,
      400,
      "انتهت جلسة الربط",
      "انتهت جلسة ربط Meta. ارجع إلى AI Media Buying واضغط ربط Meta من جديد."
    );
  await db.delete(metaOAuthStates).where(eq(metaOAuthStates.id, session.id));
  try {
    const token = await exchangeCode(
      code,
      decryptSecret(session.codeVerifierEncrypted),
      session.redirectUri
    );
    const accounts = await fetchAdAccounts(token);
    const storeId = session.storeId;
    if (!storeId)
      return sendOAuthResult(
        res,
        400,
        "تعذر ربط Meta",
        "انتهت جلسة الربط. ارجع إلى AI Media Buying واضغط ربط Meta من جديد."
      );
    for (const account of accounts) {
      if (!account.id) continue;
      await saveMetaAdAccount(session.ownerId, storeId, {
        externalAccountId: account.id.replace(/^act_/, ""),
        name: account.name || account.id,
        currency: account.account_currency || "USD",
        accessToken: token,
      });
    }
    return res
      .status(200)
      .send(
        oauthResultPage(
          "تم ربط Meta بنجاح",
          `تم ربط ${accounts.length} حساب إعلاني. ستعود إلى AI Media Buying تلقائيًا.`,
          true
        )
      );
  } catch (error) {
    return sendOAuthResult(
      res,
      502,
      "تعذر إكمال ربط Meta",
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء ربط Meta. ارجع إلى AI Media Buying وأعد المحاولة."
    );
  }
}

export function registerMetaOAuthRoutes(app: Express) {
  app.get(
    "/api/meta/oauth/callback",
    (req, res) => void handleMetaOAuthCallback(req, res)
  );
}
