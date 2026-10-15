/**
 * Live verification that editing/duplicating a digital product never loses its
 * attached file, against the REAL database.
 *
 * Everything runs inside ONE transaction on ONE connection and is rolled back at
 * the end, so nothing is persisted. It mirrors the exact column set
 * `updateStoreProduct` writes (using the real `mergeDigitalFileFields` helper)
 * and the copy `duplicateStoreProduct` performs:
 *   (a) save WITHOUT touching the file → digitalFileStorageKey/Url survive,
 *   (b) an unrelated field (max downloads) still updates,
 *   (c) duplicate keeps the file reference,
 *   (d) zero probe rows remain after rollback.
 *
 * Usage:  pnpm exec tsx scripts/digital-file-preserve-check.ts
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { mergeDigitalFileFields } from "../server/digitalFileMerge";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const conn = await createConnection(url);

const FILE_KEY = "digital-products/probe/guide_abc123.pdf";
const FILE_URL = "/manus-storage/digital-products/probe/guide_abc123.pdf";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });

let productId: number | undefined;
let copyId: number | undefined;

try {
  await conn.query("START TRANSACTION");

  const [storeRows]: any = await conn.query(
    "SELECT id FROM stores WHERE isActive = 1 ORDER BY id LIMIT 1"
  );
  if (!storeRows.length) throw new Error("no active store to probe against");
  const storeId = storeRows[0].id;

  const [ins]: any = await conn.query(
    `INSERT INTO store_products
       (ownerId, storeId, title, description, productKind, currency, status, price,
        digitalFileName, digitalFileStorageKey, digitalFileUrl, digitalFileSize,
        digitalFileMimeType, digitalMaxDownloads, digitalLinkValidityHours)
     VALUES (?, ?, ?, 'probe description', 'digital', 'DZD', 'active', '10.00',
        'guide.pdf', ?, ?, 1234, 'application/pdf', 5, 72)`,
    [storeId, storeId, `probe-${Date.now().toString(36)}`, FILE_KEY, FILE_URL]
  );
  productId = Number(ins.insertId);

  const [before]: any = await conn.query(
    "SELECT * FROM store_products WHERE id = ?",
    [productId]
  );

  // The edit form sends only settings, never the file fields.
  const merged = mergeDigitalFileFields(before[0], { digitalMaxDownloads: 3 });

  await conn.query(
    `UPDATE store_products
        SET title = ?, digitalFileName = ?, digitalFileStorageKey = ?,
            digitalFileUrl = ?, digitalFileSize = ?, digitalFileMimeType = ?,
            digitalMaxDownloads = ?, digitalLinkValidityHours = ?
      WHERE id = ?`,
    [
      "renamed without touching the file",
      merged.digitalFileName,
      merged.digitalFileStorageKey,
      merged.digitalFileUrl,
      merged.digitalFileSize,
      merged.digitalFileMimeType,
      merged.digitalMaxDownloads,
      merged.digitalLinkValidityHours,
      productId,
    ]
  );

  const [after]: any = await conn.query(
    "SELECT * FROM store_products WHERE id = ?",
    [productId]
  );
  check(
    "file key survives a save that does not touch the file",
    after[0].digitalFileStorageKey === FILE_KEY,
    String(after[0].digitalFileStorageKey)
  );
  check(
    "file url survives a save that does not touch the file",
    after[0].digitalFileUrl === FILE_URL,
    String(after[0].digitalFileUrl)
  );
  check(
    "file name survives a save that does not touch the file",
    after[0].digitalFileName === "guide.pdf"
  );
  check(
    "the setting that WAS sent still updates",
    Number(after[0].digitalMaxDownloads) === 3,
    String(after[0].digitalMaxDownloads)
  );

  // Mirrors duplicateStoreProduct: copy the row, file refs included.
  const [dupIns]: any = await conn.query(
    `INSERT INTO store_products
       (ownerId, storeId, title, description, productKind, currency, status, price,
        digitalFileName, digitalFileStorageKey, digitalFileUrl, digitalFileSize,
        digitalFileMimeType, digitalMaxDownloads, digitalLinkValidityHours)
     SELECT ownerId, storeId, CONCAT(title, ' — copy'), description, productKind,
            currency, status, price, digitalFileName, digitalFileStorageKey,
            digitalFileUrl, digitalFileSize, digitalFileMimeType,
            digitalMaxDownloads, digitalLinkValidityHours
       FROM store_products WHERE id = ?`,
    [productId]
  );
  copyId = Number(dupIns.insertId);

  const [copy]: any = await conn.query(
    "SELECT * FROM store_products WHERE id = ?",
    [copyId]
  );
  check(
    "duplicate keeps the file reference",
    copy[0].digitalFileStorageKey === FILE_KEY &&
      copy[0].digitalFileUrl === FILE_URL
  );

  await conn.query("ROLLBACK");

  const [rem]: any = await conn.query(
    "SELECT COUNT(*) AS n FROM store_products WHERE id IN (?, ?)",
    [productId, copyId]
  );
  check("no probe rows remain after rollback", Number(rem[0].n) === 0);
} finally {
  await conn.end();
}

let passed = 0;
for (const r of results) {
  if (r.ok) passed += 1;
  console.log(`${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(`${passed}/${results.length} PASS`);
if (passed !== results.length) process.exit(1);
