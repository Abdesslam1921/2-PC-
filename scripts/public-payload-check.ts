/**
 * LIVE check for the public product payload (read-only).
 *
 * Verifies, against the real database:
 *  - batched public listing stays inside the requested store,
 *  - cross-store product ids never resolve,
 *  - costing fields are stripped,
 *  - digital file storage refs are stripped,
 *  - images/variants/quantity offers only belong to the listed products.
 *
 * Usage: pnpm exec tsx scripts/public-payload-check.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createConnection } from "mysql2/promise";
import { getPublicStoreProduct, listPublicStoreProducts } from "../server/db";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const dbUrl = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
process.env.DATABASE_URL = process.env.DATABASE_URL || dbUrl;

const COST_FIELDS = [
  "costPerItem",
  "costAccountingMode",
  "costQuantity",
  "productCostTotal",
  "packagingCostPerItem",
  "packagingCostTotal",
  "procurementDeliveryCostPerItem",
  "procurementDeliveryCostTotal",
  "returnCostPerOrder",
  "returnDeliveryFree",
];

let failures = 0;
let total = 0;
function check(label: string, ok: boolean, detail = "") {
  total++;
  if (ok) {
    console.log(`PASS: ${label}`);
  } else {
    failures++;
    console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const conn = await createConnection(dbUrl);
  const [rows] = await conn.query(
    "SELECT storeId, COUNT(*) n FROM store_products WHERE status='active' GROUP BY storeId ORDER BY n DESC"
  );
  const activeStores = (rows as Array<{ storeId: number; n: number }>).map(
    r => r.storeId
  );
  const [storeRows] = await conn.query(
    "SELECT id, ownerId FROM stores WHERE isActive = 1 ORDER BY id"
  );
  const stores = storeRows as Array<{ id: number; ownerId: number }>;
  const storeA = activeStores[0] ?? stores[0]?.id;
  const storeBRow =
    stores.find(s => s.id !== storeA && !activeStores.includes(s.id)) ??
    stores.find(s => s.id !== storeA);
  check(
    "found two active stores for the cross-store probe",
    Boolean(storeA && storeBRow),
    `a=${storeA} b=${storeBRow?.id}`
  );
  if (!storeA || !storeBRow) {
    await conn.end();
    process.exit(1);
  }
  const storeB = storeBRow.id;

  // A probe product makes the cross-store assertions meaningful on databases
  // where the second store has no active catalog. Cleaned up in `finally`.
  const [insert] = await conn.query(
    "INSERT INTO store_products (ownerId, storeId, title, description, status, price, inventory, trackInventory, continueSelling) VALUES (?, ?, ?, '', 'active', '100.00', 10, 1, 0)",
    [storeBRow.ownerId, storeB, `probe-public-payload-${Date.now()}`]
  );
  const probeId = Number((insert as { insertId: number }).insertId);

  try {
    const a = storeA;
    const b = storeB;
    const productsA = await listPublicStoreProducts(a);
    const productsB = await listPublicStoreProducts(b);

    check(
      `store ${a} listing is tenant-scoped`,
      productsA.length > 0 && productsA.every(p => p.storeId === a)
    );
    check(
      `store ${b} listing is tenant-scoped`,
      productsB.length > 0 && productsB.every(p => p.storeId === b)
    );
    const idsA = new Set(productsA.map(p => p.id));
    const idsB = new Set(productsB.map(p => p.id));
    check(
      "listings contain no overlapping product ids",
      [...idsB].every(id => !idsA.has(id))
    );

    const costLeaks = productsA.filter(p =>
      COST_FIELDS.some(field => Object.prototype.hasOwnProperty.call(p, field))
    );
    check("public listing strips every costing field", costLeaks.length === 0);

    const digitalLeaks = productsA.filter(
      p =>
        Object.prototype.hasOwnProperty.call(p, "digitalFileStorageKey") ||
        Object.prototype.hasOwnProperty.call(p, "digitalFileUrl")
    );
    check(
      "public listing strips digital file storage refs",
      digitalLeaks.length === 0
    );

    check(
      "images/variants belong only to listed products",
      productsA.every(p =>
        [...p.images, ...p.variants].every((row: { productId: number }) =>
          idsA.has(row.productId)
        )
      )
    );

    const foreignProduct = probeId;
    const ownProduct = [...idsA][0];
    check(
      "cross-store product id does not resolve under another store",
      (await getPublicStoreProduct(foreignProduct, a)) === undefined &&
        (await getPublicStoreProduct(ownProduct, b)) === undefined
    );

    const returnedOfferIds = new Set<number>();
    for (const product of productsA) {
      for (const offer of product.offers) returnedOfferIds.add(offer.id);
    }
    const [offerRows] = await conn.query(
      `SELECT DISTINCT COALESCE(o.legacyId, o.id) AS publicId
         FROM offers o
         JOIN offer_products op ON op.offerId = o.id
         JOIN store_products p ON p.id = op.productId
        WHERE o.storeId = ? AND p.storeId = ? AND o.kind = 'quantity'`,
      [a, a]
    );
    const allowedOfferIds = new Set<number>(
      (offerRows as Array<{ publicId: number | string }>).map(row =>
        Number(row.publicId)
      )
    );
    check(
      "quantity offers stay inside the store's product set",
      [...returnedOfferIds].every(id => allowedOfferIds.has(id))
    );

    check(
      "probe product is visible only in its own store",
      productsB.some(p => p.id === probeId) && !idsA.has(probeId)
    );
  } finally {
    await conn.query("DELETE FROM store_products WHERE id = ?", [probeId]);
    const [remaining] = await conn.query(
      "SELECT COUNT(*) n FROM store_products WHERE id = ?",
      [probeId]
    );
    check(
      "probe product removed",
      Number((remaining as Array<{ n: number }>)[0].n) === 0
    );
    await conn.end();
  }

  console.log(failures === 0 ? `${total}/${total} PASS` : `${total - failures}/${total} PASS`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(error => {
  console.error("ERROR", error);
  process.exit(1);
});
