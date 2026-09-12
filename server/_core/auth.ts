import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId } from "../db";
import { ENV } from "./env";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export type SessionTokenPayload = {
  openId: string;
  email: string | null;
  name: string | null;
};

function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionTokenPayload
): Promise<string> {
  const issuedAt = Date.now();
  const expiresInSeconds = Math.floor((issuedAt + SESSION_MAX_AGE_MS) / 1000);

  return new SignJWT({
    openId: payload.openId,
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresInSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionTokenPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    const openId = payload.openId;
    if (typeof openId !== "string" || openId.length === 0) return null;

    return {
      openId,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

export async function getUserFromSessionCookie(
  req: Request
): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = cookies[SESSION_COOKIE_NAME];
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await getUserByOpenId(session.openId);
  return user ?? null;
}
