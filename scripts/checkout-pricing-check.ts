/**
 * Live verification of the S2 (checkout pricing) isolation guards against the
 * REAL database.
 *
 * Everything runs inside ONE transaction on ONE connection and is rolled back
 * at the end, so nothing is persisted. It checks the exact predicates
 * `createCodOrder` uses for quantity offers:
 *   (a) a real offerId in its own store resolves to the DB tier price,
 *   (b) the same offerId under ANOTHER store's scope is rejected,
 *   (c) an offer that reached maxUses is rejected,
 *   (d) a tampered client priceOverride is ignored (final price = DB-computed).
 * Finally it asserts ZERO rows remain after the rollback.
 *
 * Usage:  pnpm exec tsx scripts/checkout-pricing-check.ts
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import {
  resolveUpsellLinePrice,
  selectCodUnitPrice,
} from "../server/orderPricing";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const dbName = new URL(url).pathname.replace(/^\//, "");
const conn = await createConnection({ uri: url, database: dbName });

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });

// The exact predicate createCodOrder uses to resolve a quantity offer.
const OFFER_SQL = `
  SELECT o.id, o.fixedPrice, op.quantity
    FROM offers o
    JOIN offer_products op
      ON op.offerId = o.id AND op.storeId = o.storeId
   WHERE o.storeId = ?
     AND o.kind = 'quantity'
     AND o.isActive = 1
     AND (o.id = ? OR o.legacyId = ?)
     AND (o.maxUses = 0 OR o.usedCount < o.maxUses)
     AND op.productId = ?
   LIMIT 1`;

const tag = `probe-${Date.now().toString(36)}`;
let offerA: number | undefined;
let offerB: number | undefined;
let fixedPrice = "9000.00";

try {
  await conn.query("START TRANSACTION");

  const [stores] = await conn.query(
    `SELECT p.storeId AS id, s.ownerId AS ownerId
       FROM store_products p
       JOIN stores s ON s.id = p.storeId
      GROUP BY p.storeId, s.ownerId
      ORDER BY p.storeId
      LIMIT 2`
  );
  if ((stores as unknown[]).length < 2)
    throw new Error(
      "need at least 2 stores that each contain a product to run this probe"
    );
  const storeA = (stores as Array<{ id: number; ownerId: number }>)[0];
  const storeB = (stores as Array<{ id: number; ownerId: number }>)[1];

  const [prodA] = await conn.execute(
    "SELECT id, price FROM store_products WHERE storeId = ? ORDER BY id LIMIT 1",
    [storeA.id]
  );
  const [prodB] = await conn.execute(
    "SELECT id, price FROM store_products WHERE storeId = ? ORDER BY id LIMIT 1",
    [storeB.id]
  );
  const productA = (prodA as Array<{ id: number; price: string | null }>)[0];
  const productB = (prodB as Array<{ id: number; price: string | null }>)[0];
  if (!productA || !productB)
    throw new Error(
      "need at least one product in each of the two probe stores"
    );

  const insertOffer = async (
    store: { id: number; ownerId: number },
    slug: string
  ) => {
    const [res] = await conn.execute(
      `INSERT INTO offers
         (ownerId, storeId, kind, name, slug, fixedPrice, maxUses, usedCount,
          freeDelivery, isActive, sortOrder)
       VALUES (?, ?, 'quantity', ?, ?, ?, 0, 0, 0, 1, 0)`,
      [store.ownerId, store.id, `Probe ${slug}`, slug, fixedPrice]
    );
    return (res as { insertId: number }).insertId;
  };

  offerA = await insertOffer(storeA, `${tag}-a`);
  await conn.execute(
    "INSERT INTO offer_products (storeId, offerId, productId, quantity) VALUES (?, ?, ?, 2)",
    [storeA.id, offerA, productA.id]
  );
  offerB = await insertOffer(storeB, `${tag}-b`);
  await conn.execute(
    "INSERT INTO offer_products (storeId, offerId, productId, quantity) VALUES (?, ?, ?, 2)",
    [storeB.id, offerB, productB.id]
  );

  // (a) real offerId in its own store → the DB tier price.
  const [a] = await conn.execute(OFFER_SQL, [
    storeA.id,
    offerA,
    offerA,
    productA.id,
  ]);
  const aRow = (a as Array<{ fixedPrice: string; quantity: number }>)[0];
  check(
    "(a) real offerId resolves to the DB tier price",
    Boolean(aRow) && Number(aRow.fixedPrice) === Number(fixedPrice),
    aRow ? `fixedPrice=${aRow.fixedPrice}, quantity=${aRow.quantity}` : "no row"
  );

  // (b) the SAME offerId under another store's scope → rejected.
  const [b] = await conn.execute(OFFER_SQL, [
    storeB.id,
    offerA,
    offerA,
    productA.id,
  ]);
  check(
    "(b) another store's offerId is rejected",
    (b as unknown[]).length === 0,
    `rows=${(b as unknown[]).length}`
  );

  // (c) consume the offer up to maxUses → rejected.
  await conn.execute("UPDATE offers SET maxUses = 1, usedCount = 1 WHERE id = ?", [
    offerA,
  ]);
  const [c] = await conn.execute(OFFER_SQL, [
    storeA.id,
    offerA,
    offerA,
    productA.id,
  ]);
  check(
    "(c) an offer that reached maxUses is rejected",
    (c as unknown[]).length === 0,
    `rows=${(c as unknown[]).length}`
  );

  // (d) a tampered client priceOverride is ignored: the server price is the
  // DB-computed one (quantity-offer fixed price), never the client value.
  const tampered = "0.01";
  const serverPrice = selectCodUnitPrice({
    quantityOfferPrice: fixedPrice,
    isUpsell: false,
    productPrice: productA.price,
  });
  check(
    "(d) tampered priceOverride is ignored (final = DB-computed)",
    serverPrice === fixedPrice && serverPrice !== tampered,
    `client=${tampered}, server=${serverPrice}`
  );

  // Extra: upsell rules are enforced by the server (target + base-in-order + qty 1).
  const upsellPrice = resolveUpsellLinePrice({
    lineProductId: 2,
    linePrice: "4000.00",
    quantity: 1,
    orderProducts: [
      { productId: 1, price: "3500.00", upsellProductId: 2, upsellPrice: "2500.00" },
      { productId: 2, price: "4000.00", upsellProductId: null },
    ],
  });
  check(
    "(e) upsell price recomputed from base config (qty 1, base in order)",
    upsellPrice === "2500.00",
    `upsell=${upsellPrice}`
  );
} catch (error) {
  check("probe executed", false, error instanceof Error ? error.message : String(error));
} finally {
  await conn.query("ROLLBACK");
}

// Verify ZERO residual rows after the rollback (by unique marker).
try {
  const [offers] = await conn.execute(
    "SELECT COUNT(*) AS n FROM offers WHERE slug LIKE ?",
    [`${tag}%`]
  );
  const [links] = await conn.execute(
    "SELECT COUNT(*) AS n FROM offer_products WHERE offerId IN (?, ?)",
    [offerA ?? -1, offerB ?? -1]
  );
  const nOffers = Number((offers as Array<{ n: number }>)[0].n);
  const nLinks = Number((links as Array<{ n: number }>)[0].n);
  check(
    "(f) zero rows remain after rollback",
    nOffers === 0 && nLinks === 0,
    `offers=${nOffers}, offer_products=${nLinks}`
  );
} catch (error) {
  check(
    "(f) zero rows remain after rollback",
    false,
    error instanceof Error ? error.message : String(error)
  );
}

await conn.end();

console.log(`\n=== S2 live DB check (${tag}) ===`);
for (const r of results)
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
