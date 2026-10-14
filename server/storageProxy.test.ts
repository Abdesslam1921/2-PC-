import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerStorageProxy } from "./_core/storageProxy";
import {
  LOCAL_STORAGE_ROOT,
  resolveWithinStorageRoot,
  sanitizeStorageKey,
} from "./_core/storagePaths";

describe("sanitizeStorageKey — rejects path traversal and encoding tricks", () => {
  const attacks = [
    "../secret",
    "products/../../package.json",
    "products/..%2f..%2fpackage.json",
    "%2e%2e%2f%2e%2e%2fpackage.json",
    "..%5c..%5cpackage.json",
    "products\\..\\..\\package.json",
    "products/%252e%252e%252fpackage.json",
    "products/%00.png",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "",
    ".",
    "..",
    "./products",
  ];

  it.each(attacks)("refuses %j", raw => {
    expect(sanitizeStorageKey(raw)).toBeNull();
  });

  it("keeps a legitimate product image key untouched", () => {
    expect(sanitizeStorageKey("products/42/1700000000000-0.jpg")).toBe(
      "products/42/1700000000000-0.jpg"
    );
  });

  it("resolveWithinStorageRoot refuses anything outside the root", () => {
    const root = path.resolve(LOCAL_STORAGE_ROOT);
    expect(resolveWithinStorageRoot("products/42/a.png")).toBe(
      path.join(root, "products", "42", "a.png")
    );
    expect(resolveWithinStorageRoot("../package.json")).toBeNull();
    expect(resolveWithinStorageRoot(path.join("..", "..", "package.json"))).toBeNull();
  });
});

describe("GET /manus-storage/* — real proxy end to end", () => {
  const server = express();
  registerStorageProxy(server);
  let listener: http.Server;
  let port = 0;

  const legitRelKey = "products/99/legit-storage-probe.png";
  const legitAbsPath = path.join(LOCAL_STORAGE_ROOT, legitRelKey);
  const legitBody = "LEGIT-IMAGE-BYTES";

  // A sentinel that must never leak through any traversal attempt.
  const packageSentinel = "abdou-store";

  beforeAll(async () => {
    await fs.promises.mkdir(path.dirname(legitAbsPath), { recursive: true });
    await fs.promises.writeFile(legitAbsPath, legitBody);
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
    await fs.promises.rm(legitAbsPath, { force: true });
  });

  function rawGet(rawPath: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port, path: rawPath }, res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
    });
  }

  it("serves a legitimate product image", async () => {
    const res = await rawGet(`/manus-storage/${legitRelKey}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain(legitBody);
  });

  it.each([
    "/manus-storage/products/..%2f..%2fpackage.json",
    "/manus-storage/%2e%2e%2f%2e%2e%2fpackage.json",
    "/manus-storage/..%5c..%5cpackage.json",
    "/manus-storage/products/%252e%252e%252f%252e%252e%252fpackage.json",
    "/manus-storage/products/%00.png",
    "/manus-storage/%2fetc%2fpasswd",
  ])("rejects traversal %s with no file content", async rawPath => {
    const res = await rawGet(rawPath);
    expect([400, 404]).toContain(res.status);
    expect(res.body).not.toContain(packageSentinel);
  });
});
