import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerStorageProxy } from "./_core/storageProxy";
import { registerDigitalMediaRoute } from "./_core/digitalMedia";
import { LOCAL_STORAGE_ROOT } from "./_core/storagePaths";
import {
  isProtectedStorageKey,
  signMediaUrl,
  verifyMediaSignature,
} from "./_core/mediaSignature";
import { storageGetSignedUrl } from "./storage";

const DIGITAL_KEY = "digital-products/42/paid-guide.pdf";
const DIGITAL_BODY = "PAID-DIGITAL-CONTENT-MUST-NEVER-LEAK";
const PUBLIC_KEY = "products/42/public-image.png";
const PUBLIC_BODY = "PUBLIC-IMAGE-BYTES";

describe("mediaSignature — HMAC + expiry", () => {
  it("flags only digital-products keys as protected", () => {
    expect(isProtectedStorageKey(DIGITAL_KEY)).toBe(true);
    expect(isProtectedStorageKey(PUBLIC_KEY)).toBe(false);
  });

  it("validates a fresh signature and the embedded key/expiry", () => {
    const url = signMediaUrl(DIGITAL_KEY);
    const params = new URLSearchParams(url.split("?")[1]);
    const key = params.get("key")!;
    expect(key).toBe(DIGITAL_KEY);
    expect(verifyMediaSignature(key, params.get("exp"), params.get("sig"))).toBe(
      true
    );
  });

  it("rejects an expired signature", () => {
    const url = signMediaUrl(DIGITAL_KEY, -1000);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(
      verifyMediaSignature(DIGITAL_KEY, params.get("exp"), params.get("sig"))
    ).toBe(false);
  });

  it("rejects a tampered signature and a tampered key", () => {
    const url = signMediaUrl(DIGITAL_KEY);
    const params = new URLSearchParams(url.split("?")[1]);
    const sig = params.get("sig")!;
    const wrongSig = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(
      verifyMediaSignature(DIGITAL_KEY, params.get("exp"), wrongSig)
    ).toBe(false);
    expect(
      verifyMediaSignature(DIGITAL_KEY + "x", params.get("exp"), sig)
    ).toBe(false);
  });
});

describe("protected digital files end to end", () => {
  const server = express();
  registerStorageProxy(server);
  registerDigitalMediaRoute(server);
  let listener: http.Server;
  let port = 0;

  const digitalAbs = path.join(LOCAL_STORAGE_ROOT, DIGITAL_KEY);
  const publicAbs = path.join(LOCAL_STORAGE_ROOT, PUBLIC_KEY);

  beforeAll(async () => {
    await fs.promises.mkdir(path.dirname(digitalAbs), { recursive: true });
    await fs.promises.writeFile(digitalAbs, DIGITAL_BODY);
    await fs.promises.mkdir(path.dirname(publicAbs), { recursive: true });
    await fs.promises.writeFile(publicAbs, PUBLIC_BODY);
    await new Promise<void>(resolve => {
      listener = server.listen(0, () => {
        const address = listener.address();
        port = typeof address === "object" && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => listener.close(() => resolve()));
    await fs.promises.rm(digitalAbs, { force: true });
    await fs.promises.rm(publicAbs, { force: true });
  });

  function rawGet(
    rawPath: string
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port, path: rawPath }, res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
    });
  }

  it("refuses a direct digital key through the public proxy", async () => {
    const res = await rawGet(`/manus-storage/${DIGITAL_KEY}`);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(DIGITAL_BODY);
  });

  it("serves a perfectly signed link once (valid download)", async () => {
    const url = signMediaUrl(DIGITAL_KEY);
    const res = await rawGet(url);
    expect(res.status).toBe(200);
    expect(res.body).toContain(DIGITAL_BODY);
  });

  it("refuses an expired link", async () => {
    const url = signMediaUrl(DIGITAL_KEY, -1000);
    const res = await rawGet(url);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain(DIGITAL_BODY);
  });

  it("refuses a wrong signature", async () => {
    const url = signMediaUrl(DIGITAL_KEY);
    const params = new URLSearchParams(url.split("?")[1]);
    const sig = params.get("sig")!;
    params.set("sig", (sig[0] === "a" ? "b" : "a") + sig.slice(1));
    const res = await rawGet(`/api/media?${params.toString()}`);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain(DIGITAL_BODY);
  });

  it("refuses a non-protected key through the signed media route", async () => {
    const url = `/api/media?key=${encodeURIComponent(PUBLIC_KEY)}&exp=${Math.floor(
      Date.now() / 1000
    ) + 60}&sig=deadbeef`;
    const res = await rawGet(url);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain(PUBLIC_BODY);
  });

  it("keeps public images working through the proxy", async () => {
    const res = await rawGet(`/manus-storage/${PUBLIC_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain(PUBLIC_BODY);
  });

  it("storageGetSignedUrl returns a signed /api/media URL for digital keys and the plain proxy URL otherwise (local mode)", async () => {
    const digital = await storageGetSignedUrl(DIGITAL_KEY);
    expect(digital.startsWith("/api/media?")).toBe(true);
    const params = new URLSearchParams(digital.split("?")[1]);
    expect(
      verifyMediaSignature(
        params.get("key")!,
        params.get("exp"),
        params.get("sig")
      )
    ).toBe(true);

    const publicUrl = await storageGetSignedUrl(PUBLIC_KEY);
    expect(publicUrl).toBe(`/manus-storage/${PUBLIC_KEY}`);
  });
});
