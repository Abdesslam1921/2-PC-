/**
 * Propose (and optionally apply) categories from the archived `collectionName`
 * values of existing products.
 *
 * Default is a DRY RUN: it only prints the proposal per store, so a human can
 * review it before anything is written. Nothing is ever deleted — `collectionName`
 * stays as archive data.
 *
 * Usage:
 *   node scripts/categories-seed.mjs            # dry run (proposal only)
 *   node scripts/categories-seed.mjs --apply    # create categories + link products
 *
 * Safety:
 *  - A store that already has categories is skipped unless --force is passed.
 *  - Only products with `categoryId IS NULL` are linked (never re-links).
 *  - Idempotent: an existing (storeId, slug) is reused instead of re-created.
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";

const ROOT = "C:/dev/abdou-store-main";
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

const env = fs.readFileSync(`${ROOT}/.env`, "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)[1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const dbName = new URL(url).pathname.replace(/^\//, "");
const conn = await createConnection({ uri: url, database: dbName });

const isSlugChar = ch => {
  if (/[A-Za-z0-9]/.test(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
};

const slugify = value => {
  const cleaned = String(value ?? "").trim().replace(/[\s_]+/g, "-");
  let out = "";
  for (const ch of cleaned) {
    if (ch === "-") out += "-";
    else if (isSlugChar(ch)) out += /[A-Za-z]/.test(ch) ? ch.toLowerCase() : ch;
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
};

const [stores] = await conn.query(
  "SELECT id, ownerId, name FROM stores ORDER BY id"
);
const [rows] = await conn.query(
  `SELECT storeId, collectionName, COUNT(*) AS products
     FROM store_products
    WHERE collectionName IS NOT NULL AND TRIM(collectionName) <> ''
    GROUP BY storeId, collectionName
    ORDER BY storeId, products DESC`
);
const [existing] = await conn.query(
  "SELECT storeId, slug, id FROM categories"
);

const existingByStore = new Map();
for (const row of existing) {
  if (!existingByStore.has(row.storeId)) existingByStore.set(row.storeId, new Map());
  existingByStore.get(row.storeId).set(row.slug, row.id);
}

console.log(apply ? "MODE: APPLY" : "MODE: DRY RUN (no writes)");
console.log("=".repeat(64));

let created = 0;
let linked = 0;
let skippedStores = 0;

for (const store of stores) {
  const proposals = rows.filter(row => row.storeId === store.id);
  console.log(`\nمتجر #${store.id} — ${store.name}`);
  if (proposals.length === 0) {
    console.log("  (لا collectionName — لا اقتراحات)");
    continue;
  }
  const alreadyHasCategories = (existingByStore.get(store.id)?.size ?? 0) > 0;
  if (alreadyHasCategories && !force) {
    skippedStores++;
    console.log("  ⏭  عنده فئات من قبل — تم التخطي (استعمل --force للتجاوز)");
    continue;
  }
  for (const [index, proposal] of proposals.entries()) {
    const slug = slugify(proposal.collectionName);
    const known = existingByStore.get(store.id)?.get(slug);
    const label = `${proposal.collectionName}  →  slug=${slug || "(فارغ!)"}  ·  ${proposal.products} منتج`;
    if (!slug) {
      console.log(`  ⚠  ${label} — لا يمكن توليد slug، سيُتخطى`);
      continue;
    }
    if (!apply) {
      console.log(`  • ${label}${known ? "  (موجودة)" : ""}`);
      continue;
    }
    let categoryId = known;
    if (!categoryId) {
      const [res] = await conn.execute(
        `INSERT INTO categories (ownerId, storeId, name, slug, sortOrder, isActive)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [store.ownerId, store.id, proposal.collectionName, slug, index]
      );
      categoryId = res.insertId;
      created++;
      if (!existingByStore.has(store.id)) existingByStore.set(store.id, new Map());
      existingByStore.get(store.id).set(slug, categoryId);
    }
    const [link] = await conn.execute(
      `UPDATE store_products
          SET categoryId = ?
        WHERE storeId = ?
          AND categoryId IS NULL
          AND collectionName = ?`,
      [categoryId, store.id, proposal.collectionName]
    );
    linked += link.affectedRows ?? 0;
    console.log(`  ✓ ${label}${known ? "  (موجودة، تم الربط فقط)" : ""}`);
  }
}

if (apply) {
  console.log("\n" + "=".repeat(64));
  console.log(`فئات جديدة: ${created} · منتجات مربوطة: ${linked}`);
} else {
  console.log("\n" + "=".repeat(64));
  console.log("لم يُكتب أي شيء. للموافقة بعد المراجعة: node scripts/categories-seed.mjs --apply");
}
if (skippedStores) console.log(`(متاجر متخطّاة لأن عندها فئات: ${skippedStores})`);

await conn.end();
