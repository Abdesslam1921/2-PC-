/**
 * LIVE SEO verification against the REAL database.
 *
 * Creates a dedicated probe store/product (prefix `probesfseo-`), starts a
 * local Express app with the production SEO middleware/routes, and asserts the
 * first HTML response contains store/product title, canonical, OG, JSON-LD,
 * robots and sitemap data. Cleans up exactly the probe rows.
 *
 * Usage: pnpm exec tsx scripts/seo-check.ts
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createConnection } from "mysql2/promise";
import express from "express";
import { applySeoToHtml, registerSeoRoutes } from "../server/seoRoutes";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
process.env.DATABASE_URL = process.env.DATABASE_URL || url;

const PREFIX = "probesfseo-";
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const STORE_SLUG = `${PREFIX}store-${RUN_ID}`;
const STORE_HOST = `${STORE_SLUG}.abdou-store.com`;
const OWNER_OPEN_ID = `${PREFIX}owner-${RUN_ID}`;
const OWNER_EMAIL = `${OWNER_OPEN_ID}@probe.invalid`;

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });

const conn = await createConnection(url);
const q = async (sql: string, values: unknown[] = []) => {
  const [rows] = (await conn.query(sql, values)) as [any, unknown];
  return rows;
};

let ownerId: number | undefined;
let storeId: number | undefined;
let productId: number | undefined;
let imageId: number | undefined;
let server: http.Server | undefined;

const request = (
  port: number,
  requestPath: string
): Promise<{ status: number; body: string; contentType: string }> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: "GET",
        headers: { Host: STORE_HOST },
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            contentType: String(res.headers["content-type"] ?? ""),
          })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });

try {
  const ownerRes = await q(
    `INSERT INTO users (openId, name, email, loginMethod, role)
     VALUES (?, 'SEO Probe Owner', ?, 'probe', 'user')`,
    [OWNER_OPEN_ID, OWNER_EMAIL]
  );
  ownerId = Number(ownerRes.insertId);
  const storeRes = await q(
    `INSERT INTO stores (ownerId, name, slug, language, isActive)
     VALUES (?, 'متجر SEO التجريبي', ?, 'dz-ar', 1)`,
    [ownerId, STORE_SLUG]
  );
  storeId = Number(storeRes.insertId);
  const productRes = await q(
    `INSERT INTO store_products
       (ownerId, storeId, title, description, status, price, currency,
        inventory, trackInventory, continueSelling, sku, productType)
     VALUES (?, ?, 'حقيبة SEO التجريبية', '<p>حقيبة جلدية للاختبار</p>', 'active',
             '4500.00', 'DZD', 3, 1, 0, 'SEO-1', 'حقائب')`,
    [ownerId, storeId]
  );
  productId = Number(productRes.insertId);
  const imageRes = await q(
    `INSERT INTO store_product_images (productId, storageKey, url, altText, position)
     VALUES (?, 'probe-seo.jpg', '/manus-storage/probe-seo.jpg', 'حقيبة', 0)`,
    [productId]
  );
  imageId = Number(imageRes.insertId);

  check(
    "probe store/product are dedicated",
    Number(storeId) > 0 && Number(productId) > 0
  );

  const indexHtml = fs.readFileSync(
    path.join(ROOT, "client", "index.html"),
    "utf8"
  );
  const app = express();
  app.use((_req, res, next) => {
    // Simulates the production subdomain resolver.
    res.locals.store = {
      id: storeId,
      ownerId,
      name: "متجر SEO التجريبي",
      slug: STORE_SLUG,
    };
    next();
  });
  registerSeoRoutes(app);
  app.use("*", async (req, res, next) => {
    try {
      const page = await applySeoToHtml(req, indexHtml, res.locals.store);
      res.status(200).type("html").send(page);
    } catch (error) {
      next(error);
    }
  });

  server = http.createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const home = await request(port, "/");
  const origin = `http://${STORE_HOST}`;
  check(
    "store home HTML carries title/canonical/OG",
    home.status === 200 &&
      home.body.includes("<title>متجر SEO التجريبي</title>") &&
      home.body.includes(`<link rel="canonical" href="${origin}/">`) &&
      home.body.includes('property="og:title"') &&
      home.body.includes('"@type":"WebSite"'),
    `status=${home.status}`
  );

  const product = await request(port, `/p/${productId}?utm=probe`);
  check(
    "product HTML carries title/canonical/product JSON-LD/price",
    product.status === 200 &&
      product.body.includes("حقيبة SEO التجريبية") &&
      product.body.includes(`<link rel="canonical" href="${origin}/p/${productId}">`) &&
      product.body.includes('"@type":"Product"') &&
      product.body.includes('"price":"4500.00"') &&
      product.body.includes('"availability":"https://schema.org/InStock"') &&
      product.body.includes(`${origin}/manus-storage/probe-seo.jpg`),
    `status=${product.status}`
  );
  check(
    "product JSON-LD includes BreadcrumbList",
    product.body.includes('"@type":"BreadcrumbList"')
  );

  const sitemap = await request(port, "/sitemap.xml");
  check(
    "sitemap lists home + product",
    sitemap.status === 200 &&
      sitemap.contentType.includes("xml") &&
      sitemap.body.includes(`${origin}/</loc>`) &&
      sitemap.body.includes(`${origin}/p/${productId}</loc>`),
    `status=${sitemap.status}`
  );

  const robots = await request(port, "/robots.txt");
  check(
    "robots points at the store sitemap",
    robots.status === 200 &&
      robots.body.includes(`Sitemap: ${origin}/sitemap.xml`) &&
      robots.body.includes("Disallow: /dashboard")
  );

  const dashboard = await request(port, "/dashboard");
  check(
    "private dashboard HTML is not SEO-injected",
    dashboard.status === 200 && !dashboard.body.includes("<!-- seo:start -->")
  );

  const missing = await request(port, "/p/999999999");
  check(
    "missing product falls back to store meta (no Product schema)",
    missing.status === 200 &&
      missing.body.includes("<title>متجر SEO التجريبي</title>") &&
      !missing.body.includes('"@type":"Product"')
  );
} catch (error) {
  check(
    "live SEO probe completed",
    false,
    error instanceof Error ? error.message : String(error)
  );
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  if (ownerId && storeId) {
    const stores = await q("SELECT id, ownerId, slug FROM stores WHERE id = ?", [
      storeId,
    ]);
    const guard =
      stores.length === 1 &&
      Number(stores[0].ownerId) === ownerId &&
      String(stores[0].slug) === STORE_SLUG;
    if (guard) {
      if (imageId)
        await q("DELETE FROM store_product_images WHERE id = ?", [imageId]);
      await q("DELETE FROM store_product_variants WHERE productId = ?", [
        productId,
      ]);
      await q("DELETE FROM offers WHERE storeId = ?", [storeId]);
      await q("DELETE FROM store_products WHERE storeId = ?", [storeId]);
      await q("DELETE FROM stores WHERE id = ? AND slug = ?", [
        storeId,
        STORE_SLUG,
      ]);
      await q("DELETE FROM users WHERE id = ? AND openId = ?", [
        ownerId,
        OWNER_OPEN_ID,
      ]);
      const left = await q(
        `SELECT
           (SELECT COUNT(*) FROM store_products WHERE storeId = ?) products,
           (SELECT COUNT(*) FROM store_product_images WHERE id = ?) images,
           (SELECT COUNT(*) FROM stores WHERE id = ?) stores,
           (SELECT COUNT(*) FROM users WHERE id = ?) users`,
        [storeId, imageId ?? 0, storeId, ownerId]
      );
      check(
        "zero probe SEO rows remain",
        Object.values(left[0] as Record<string, number>).every(
          value => Number(value) === 0
        ),
        JSON.stringify(left[0])
      );
    } else {
      check("cleanup skipped: guard failed", false);
    }
  }
  await conn.end();
}

let passed = 0;
for (const result of results) {
  if (result.ok) passed += 1;
  console.log(
    `${result.ok ? "PASS" : "FAIL"}: ${result.name}${
      result.detail ? ` (${result.detail})` : ""
    }`
  );
}
console.log(`${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
