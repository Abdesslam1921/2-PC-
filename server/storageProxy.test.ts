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

  it("keeps unicode and spaced names untouched (Arabic, spaces, parentheses)", () => {
    expect(sanitizeStorageKey("products/42/صورة المنتج (1).png")).toBe(
      "products/42/صورة المنتج (1).png"
    );
    expect(sanitizeStorageKey("generated/1787708106245_b00fc9c4 (1).png")).toBe(
      "generated/1787708106245_b00fc9c4 (1).png"
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

describe("GET /manus-storage/* — real files already on disk keep serving", () => {
  const server = express();
  registerStorageProxy(server);
  let listener: http.Server;
  let port = 0;

  beforeAll(async () => {
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
  });

  function rawGetBuffer(
    rawPath: string
  ): Promise<{ status: number; buffer: Buffer }> {
    return new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port, path: rawPath }, res => {
        const chunks: Buffer[] = [];
        res.on("data", chunk => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, buffer: Buffer.concat(chunks) })
        );
      });
      req.on("error", reject);
    });
  }

  // Enumerate the real files already under file_storage, prioritising names
  // with spaces / non-ASCII characters so the sanitizer is tested against the
  // actual directory contents (not a synthetic single fixture).
  const realFiles = (() => {
    if (!fs.existsSync(LOCAL_STORAGE_ROOT)) return [] as string[];
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else out.push(path.relative(LOCAL_STORAGE_ROOT, full).split(path.sep).join("/"));
      }
    };
    walk(LOCAL_STORAGE_ROOT);
    const interesting = out.filter(k => /[^\x00-\x7F]/.test(k) || k.includes(" "));
    const rest = out.filter(k => !interesting.includes(k));
    return [...interesting, ...rest].slice(0, 25);
  })();

  it.skipIf(realFiles.length === 0)(
    "serves every sampled real file with its exact bytes",
    async () => {
      expect(realFiles.length).toBeGreaterThan(0);
      for (const relKey of realFiles) {
        const bytes = fs.readFileSync(path.join(LOCAL_STORAGE_ROOT, relKey));
        const url =
          "/manus-storage/" +
          relKey.split("/").map(encodeURIComponent).join("/");
        const res = await rawGetBuffer(url);
        expect(res.status, `status for ${relKey}`).toBe(200);
        expect(res.buffer.equals(bytes), `bytes for ${relKey}`).toBe(true);
      }
    }
  );

  it.skipIf(!realFiles.some(k => k.includes(" ") || /[^\x00-\x7F]/.test(k)))(
    "serves a real file whose name has a space or non-ASCII characters",
    async () => {
      const relKey = realFiles.find(
        k => k.includes(" ") || /[^\x00-\x7F]/.test(k)
      )!;
      const bytes = fs.readFileSync(path.join(LOCAL_STORAGE_ROOT, relKey));
      const url =
        "/manus-storage/" + relKey.split("/").map(encodeURIComponent).join("/");
      const res = await rawGetBuffer(url);
      expect(res.status).toBe(200);
      expect(res.buffer.equals(bytes)).toBe(true);
    }
  );

  it("serves an Arabic-named file end to end", async () => {
    const relKey = "products/42/صورة-اختبار عربية.png";
    const absPath = path.join(LOCAL_STORAGE_ROOT, relKey);
    const bytes = Buffer.from("ARABIC-NAME-BYTES");
    await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
    await fs.promises.writeFile(absPath, bytes);
    try {
      const url =
        "/manus-storage/" + relKey.split("/").map(encodeURIComponent).join("/");
      const res = await rawGetBuffer(url);
      expect(res.status).toBe(200);
      expect(res.buffer.equals(bytes)).toBe(true);
    } finally {
      await fs.promises.rm(absPath, { force: true });
    }
  });
});

