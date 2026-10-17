/**
 * LIVE verification of the order-creation races against the REAL database.
 *
 * Two explicit MySQL connections create a dedicated probe owner/store/products/
 * offers/agents, then exercise the production functions concurrently:
 *   (a) atomic stock reservation and all-or-nothing multi-line orders,
 *   (b) unique order numbers under concurrent inserts,
 *   (c) round-robin Call Center assignment without corrupting the rotation,
 *   (d) double submit (same phone + same lines) creating ONE order,
 *   (e) createCod atomicity (order + items + stock + usedCount + assignment),
 *   (f) idempotent status effects (stock, order_profits, order_returns).
 *
 * SAFETY: never reads, writes or deletes a real store's rows. Every probe
 * row carries the dedicated `probesforder` identity and is created by this
 * run; cleanup deletes exactly those ids (guarded by store id + ownerId +
 * slug) and verifies zero rows remain.
 *
 * Usage: pnpm exec tsx scripts/orders-concurrency-check.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import {
  applyOrderInventoryLifecycle,
  createCodOrder,
  updateStoreOrderStatus,
} from "../server/db";
import { applyShipmentStatus } from "../server/forshipDb";
import { computeShipmentUpdate } from "../server/forshipCore";
import { orderShipments } from "../drizzle/schema";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
process.env.DATABASE_URL = process.env.DATABASE_URL || url;

const PROBE_PREFIX = "probesforder-";
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PROBE_SLUG = `${PROBE_PREFIX}store-${RUN_ID}`;
const PROBE_OPEN_ID = `${PROBE_PREFIX}owner-${RUN_ID}`;
const PROBE_EMAIL = `${PROBE_OPEN_ID}@probe.invalid`;

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });

const connA: Connection = await createConnection(url);
const connB: Connection = await createConnection(url);
const dbA = drizzle(connA);

let probeStoreId: number | undefined;
let probeOwnerId: number | undefined;
let productA = 0;
let productB = 0;
let productC = 0;
let productD = 0;
let productE = 0;
let variantE = 0;
let offerMax5 = 0;
let offerMax1 = 0;
let agent1 = 0;
let agent2 = 0;
const orderIds: number[] = [];

const q = async (conn: Connection, sql: string, values: unknown[] = []) => {
  const [rows] = (await conn.query(sql, values)) as [any, unknown];
  return rows;
};

const isProbeStore = async (): Promise<boolean> => {
  if (!probeStoreId || !probeOwnerId) return false;
  const rows = await q(
    connA,
    "SELECT id, ownerId, slug FROM stores WHERE id = ?",
    [probeStoreId]
  );
  return (
    rows.length === 1 &&
    Number(rows[0].ownerId) === probeOwnerId &&
    String(rows[0].slug) === PROBE_SLUG
  );
};

const customer = (phone: string) => ({
  customerName: "Probe Customer",
  customerPhone: phone,
  wilaya: "الجزائر",
  wilayaCode: "16",
  deliveryMethod: "home" as const,
  address: "Probe address",
});

const createProduct = async (title: string, inventory: number) => {
  const res = await q(
    connA,
    `INSERT INTO store_products
       (ownerId, storeId, title, description, status, price, inventory,
        trackInventory, continueSelling, deliveryPricingMode)
     VALUES (?, ?, ?, '', 'active', '100.00', ?, 1, 0, 'manual')`,
    [probeOwnerId, probeStoreId, title, inventory]
  );
  return Number(res.insertId);
};

const createOffer = async (
  name: string,
  productId: number,
  maxUses: number
) => {
  const res = await q(
    connA,
    `INSERT INTO offers
       (ownerId, storeId, kind, name, slug, fixedPrice, maxUses, usedCount, isActive)
     VALUES (?, ?, 'quantity', ?, ?, '1500.00', ?, 0, 1)`,
    [
      probeOwnerId,
      probeStoreId,
      name,
      `${PROBE_PREFIX}${name}-${RUN_ID}`,
      maxUses,
    ]
  );
  const offerId = Number(res.insertId);
  await q(
    connA,
    `INSERT INTO offer_products (storeId, offerId, productId, quantity)
     VALUES (?, ?, ?, 2)`,
    [probeStoreId, offerId, productId]
  );
  return offerId;
};

const inventoryOf = async (productId: number) => {
  const rows = await q(
    connA,
    "SELECT inventory FROM store_products WHERE id = ?",
    [productId]
  );
  return Number(rows[0]?.inventory ?? -1);
};

const variantStockOf = async (variantId: number) => {
  const rows = await q(
    connA,
    "SELECT stock FROM store_product_variants WHERE id = ?",
    [variantId]
  );
  return Number(rows[0]?.stock ?? -1);
};

const ordersForPhone = async (phone: string) => {
  const rows = await q(
    connA,
    "SELECT id FROM store_orders WHERE storeId = ? AND customerPhone = ?",
    [probeStoreId, phone]
  );
  return rows as Array<{ id: number }>;
};

const agentForOrder = async (orderId: number) => {
  const rows = await q(
    connA,
    "SELECT DISTINCT confirmationAgentId FROM store_order_items WHERE orderId = ?",
    [orderId]
  );
  return rows.map((row: { confirmationAgentId: number | null }) =>
    Number(row.confirmationAgentId)
  );
};

try {
  const ownerRes = await q(
    connA,
    `INSERT INTO users (openId, name, email, loginMethod, role)
     VALUES (?, 'Orders Concurrency Probe Owner', ?, 'probe', 'user')`,
    [PROBE_OPEN_ID, PROBE_EMAIL]
  );
  probeOwnerId = Number(ownerRes.insertId);
  const storeRes = await q(
    connA,
    `INSERT INTO stores (ownerId, name, slug, language, isActive)
     VALUES (?, 'Orders Concurrency Probe Store', ?, 'dz-ar', 1)`,
    [probeOwnerId, PROBE_SLUG]
  );
  probeStoreId = Number(storeRes.insertId);
  check(
    "probe store is dedicated (never a real store)",
    await isProbeStore(),
    `storeId=${probeStoreId} ownerId=${probeOwnerId}`
  );

  productA = await createProduct("Probe A (stock 1)", 1);
  productB = await createProduct("Probe B (high stock)", 1000);
  productC = await createProduct("Probe C (offer)", 10);
  productD = await createProduct("Probe D (stock 0)", 0);
  productE = await createProduct("Probe E (variant)", 50);
  const variantRes = await q(
    connA,
    `INSERT INTO store_product_variants (productId, color, size, stock, available)
     VALUES (?, 'أسود', 'M', 1, 1)`,
    [productE]
  );
  variantE = Number(variantRes.insertId);
  offerMax5 = await createOffer("probe-offer-5", productC, 5);
  offerMax1 = await createOffer("probe-offer-1", productC, 1);
  const a1 = await q(
    connA,
    `INSERT INTO call_center_agents
       (ownerId, storeId, name, email, passwordHash, enabled)
     VALUES (?, ?, 'Probe Agent 1', ?, 'probe:hash', 1)`,
    [probeOwnerId, probeStoreId, `${PROBE_PREFIX}a1-${RUN_ID}@probe.invalid`]
  );
  const a2 = await q(
    connA,
    `INSERT INTO call_center_agents
       (ownerId, storeId, name, email, passwordHash, enabled)
     VALUES (?, ?, 'Probe Agent 2', ?, 'probe:hash', 1)`,
    [probeOwnerId, probeStoreId, `${PROBE_PREFIX}a2-${RUN_ID}@probe.invalid`]
  );
  agent1 = Number(a1.insertId);
  agent2 = Number(a2.insertId);
  const agentRows = await q(
    connA,
    "SELECT id, enabled FROM call_center_agents WHERE storeId = ? ORDER BY id",
    [probeStoreId]
  );
  check(
    "two enabled probe agents exist",
    agentRows.length === 2 && agentRows.every((row: { enabled: number }) => Number(row.enabled) === 1),
    JSON.stringify(agentRows)
  );

  // (a1) Last unit: exactly one of two concurrent orders wins.
  const stockRace = await Promise.allSettled([
    createCodOrder(customer("0559900001"), [{ productId: productA, quantity: 1 }]),
    createCodOrder(customer("0559900002"), [{ productId: productA, quantity: 1 }]),
  ]);
  const stockWins = stockRace.filter(r => r.status === "fulfilled") as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof createCodOrder>>>
  >;
  check(
    "last unit: exactly one of two concurrent orders succeeds",
    stockWins.length === 1 &&
      stockRace.filter(r => r.status === "rejected").length === 1
  );
  check(
    "last unit: inventory is 0 (no oversell)",
    (await inventoryOf(productA)) === 0,
    `inventory=${await inventoryOf(productA)}`
  );
  const inventoryViaB = await q(
    connB,
    "SELECT inventory FROM store_products WHERE id = ?",
    [productA]
  );
  check(
    "second connection observes the same final stock",
    Number(inventoryViaB[0].inventory) === 0,
    `connB=${inventoryViaB[0].inventory}`
  );
  const ordersA = (
    await q(
      connA,
      "SELECT COUNT(*) n FROM store_order_items WHERE productId = ?",
      [productA]
    )
  )[0].n;
  check("last unit: only one order row exists", Number(ordersA) === 1);
  stockWins.forEach(r => orderIds.push(r.value.id));

  // (a2) Multi-line all-or-nothing.
  const beforeC = await inventoryOf(productC);
  const multi = await Promise.allSettled([
    createCodOrder(customer("0559900003"), [
      { productId: productC, quantity: 1 },
      { productId: productD, quantity: 1 },
    ]),
  ]);
  check(
    "multi-line order fails when one line is out of stock",
    multi[0].status === "rejected"
  );
  check(
    "multi-line failure leaves the first line's stock untouched",
    (await inventoryOf(productC)) === beforeC,
    `before=${beforeC} after=${await inventoryOf(productC)}`
  );
  check(
    "multi-line failure leaves no order/items",
    (await ordersForPhone("0559900003")).length === 0
  );

  // (a3) Variant stock race.
  const variantRace = await Promise.allSettled([
    createCodOrder(customer("0559900004"), [
      { productId: productE, variantId: variantE, quantity: 1 },
    ]),
    createCodOrder(customer("0559900005"), [
      { productId: productE, variantId: variantE, quantity: 1 },
    ]),
  ]);
  const variantWins = variantRace.filter(r => r.status === "fulfilled") as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof createCodOrder>>>
  >;
  check(
    "variant last unit: exactly one concurrent order succeeds",
    variantWins.length === 1 &&
      variantRace.filter(r => r.status === "rejected").length === 1
  );
  check(
    "variant stock cannot go negative",
    (await variantStockOf(variantE)) === 0,
    `stock=${await variantStockOf(variantE)}`
  );
  variantWins.forEach(r => orderIds.push(r.value.id));

  // (c) Two concurrent orders must take different agents.
  const twoAssignments = await Promise.all([
    createCodOrder(customer("0559900010"), [{ productId: productB, quantity: 1 }]),
    createCodOrder(customer("0559900011"), [{ productId: productB, quantity: 1 }]),
  ]);
  twoAssignments.forEach(order => orderIds.push(order.id));
  const twoAgents = await Promise.all(twoAssignments.map(o => agentForOrder(o.id)));
  check(
    "two concurrent orders get two different agents",
    twoAgents.every(ids => ids.length === 1 && ids[0] > 0) &&
      twoAgents[0][0] !== twoAgents[1][0],
    `agents=${JSON.stringify(twoAgents)} expected=${agent1}/${agent2}`
  );

  // (b) Unique order numbers + (c) balanced rotation under pressure.
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      createCodOrder(customer(`05599001${String(index + 20).padStart(2, "0")}`), [
        { productId: productB, quantity: 1 },
      ])
    )
  );
  burst.forEach(order => orderIds.push(order.id));
  const numbers = burst.map(order => order.orderNumber);
  check(
    "concurrent orders all have distinct ABD numbers",
    new Set(numbers).size === numbers.length &&
      numbers.every(number => /^ABD-\d{6,}$/.test(number)),
    numbers.join(",")
  );
  const burstAgents = await Promise.all(burst.map(o => agentForOrder(o.id)));
  const counts = burstAgents.map(ids => ids[0]);
  const agent1Count = counts.filter(id => id === agent1).length;
  const agent2Count = counts.filter(id => id === agent2).length;
  check(
    "round-robin stays balanced (8 orders -> 4/4)",
    burstAgents.every(ids => ids.length === 1) &&
      agent1Count === 4 &&
      agent2Count === 4,
    `agent1=${agent1Count}/${agent1} agent2=${agent2Count}/${agent2} assignments=${JSON.stringify(counts)}`
  );

  // (d) Double submit.
  const doublePhone = "0559900030";
  const beforeB = await inventoryOf(productB);
  const doubleSubmit = await Promise.all([
    createCodOrder(customer(doublePhone), [{ productId: productB, quantity: 1 }]),
    createCodOrder(customer(doublePhone), [{ productId: productB, quantity: 1 }]),
  ]);
  const third = await createCodOrder(customer(doublePhone), [
    { productId: productB, quantity: 1 },
  ]);
  check(
    "double submit returns the same order id (idempotent)",
    doubleSubmit[0].id === doubleSubmit[1].id && third.id === doubleSubmit[0].id,
    doubleSubmit.map(order => order.id).join(",")
  );
  check(
    "double submit creates one order and deducts one unit",
    (await ordersForPhone(doublePhone)).length === 1 &&
      (await inventoryOf(productB)) === beforeB - 1,
    `orders=${(await ordersForPhone(doublePhone)).length} inventory=${await inventoryOf(productB)}`
  );
  orderIds.push(doubleSubmit[0].id);

  // (e1) Offer usage commits with order + stock.
  const beforeOfferC = await inventoryOf(productC);
  const offerOrder = await createCodOrder(customer("0559900040"), [
    { productId: productC, offerId: offerMax5, quantity: 1 },
  ]);
  orderIds.push(offerOrder.id);
  const offerRow = (
    await q(connA, "SELECT usedCount FROM offers WHERE id = ?", [offerMax5])
  )[0];
  check(
    "quantity offer: usedCount and stock commit together",
    Number(offerRow.usedCount) === 1 &&
      (await inventoryOf(productC)) === beforeOfferC - 2,
    `used=${offerRow.usedCount} inventory=${await inventoryOf(productC)}`
  );

  // (e2) maxUses=1 race: one order survives, the loser rolls back fully.
  const beforeRaceC = await inventoryOf(productC);
  const offerRace = await Promise.allSettled([
    createCodOrder(customer("0559900041"), [
      { productId: productC, offerId: offerMax1, quantity: 1 },
    ]),
    createCodOrder(customer("0559900042"), [
      { productId: productC, offerId: offerMax1, quantity: 1 },
    ]),
  ]);
  const offerWins = offerRace.filter(r => r.status === "fulfilled") as Array<
    PromiseFulfilledResult<Awaited<ReturnType<typeof createCodOrder>>>
  >;
  const offerUsed = (
    await q(connA, "SELECT usedCount FROM offers WHERE id = ?", [offerMax1])
  )[0];
  check(
    "maxUses race: exactly one order succeeds",
    offerWins.length === 1 &&
      offerRace.filter(r => r.status === "rejected").length === 1
  );
  offerWins.forEach(order => orderIds.push(order.id));
  check(
    "maxUses race: usedCount=1 and only one stock deduction survives",
    Number(offerUsed.usedCount) === 1 &&
      (await inventoryOf(productC)) === beforeRaceC - 2,
    `used=${offerUsed.usedCount} inventory=${await inventoryOf(productC)}`
  );

  // (f1) Returned lifecycle applied twice restores stock once.
  const restoreOrder = await createCodOrder(customer("0559900050"), [
    { productId: productB, quantity: 2 },
  ]);
  orderIds.push(restoreOrder.id);
  const beforeRestore = await inventoryOf(productB);
  await Promise.all([
    applyOrderInventoryLifecycle(probeStoreId, restoreOrder.id, "returned"),
    applyOrderInventoryLifecycle(probeStoreId, restoreOrder.id, "returned"),
  ]);
  await applyOrderInventoryLifecycle(probeStoreId, restoreOrder.id, "returned");
  check(
    "returned lifecycle is idempotent (stock restored once)",
    (await inventoryOf(productB)) === beforeRestore + 2,
    `before=${beforeRestore} after=${await inventoryOf(productB)}`
  );

  // (f2) Cancellation status restores reserved stock exactly once.
  const cancelOrder = await createCodOrder(customer("0559900051"), [
    { productId: productB, quantity: 1 },
  ]);
  orderIds.push(cancelOrder.id);
  const beforeCancel = await inventoryOf(productB);
  await Promise.all([
    updateStoreOrderStatus(probeStoreId, cancelOrder.id, "cancelled"),
    updateStoreOrderStatus(probeStoreId, cancelOrder.id, "cancelled"),
  ]);
  check(
    "cancelled status restores stock once",
    (await inventoryOf(productB)) === beforeCancel + 1,
    `before=${beforeCancel} after=${await inventoryOf(productB)}`
  );

  // (f3) Duplicate delivered webhook -> one order_profits row.
  const profitOrder = await createCodOrder(customer("0559900052"), [
    { productId: productB, quantity: 1 },
  ]);
  orderIds.push(profitOrder.id);
  const shipmentRes = await q(
    connA,
    `INSERT INTO order_shipments
       (order_id, merchant_id, carrier_id, tracking_number, external_status_label,
        status_history, sync_method, check_count)
     VALUES (?, ?, 990001, ?, 'initial', '[]', 'webhook', 0)`,
    [profitOrder.id, probeOwnerId, `${PROBE_PREFIX}track-${profitOrder.id}`]
  );
  const [profitShipment] = await dbA
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.id, Number(shipmentRes.insertId)))
    .limit(1);
  const deliveredComputed = computeShipmentUpdate(
    profitShipment,
    "probe-delivered",
    { mapsTo: "delivered", isFinal: true },
    new Date()
  );
  await Promise.all([
    applyShipmentStatus(profitShipment, "probe-delivered", deliveredComputed),
    applyShipmentStatus(profitShipment, "probe-delivered", deliveredComputed),
  ]);
  const profitRows = await q(
    connA,
    "SELECT COUNT(*) n FROM order_profits WHERE order_id = ?",
    [profitOrder.id]
  );
  check(
    "duplicate delivered webhook writes one order_profits row",
    Number(profitRows[0].n) === 1,
    `rows=${profitRows[0].n}`
  );

  // (f4) Duplicate returned webhook -> one order_returns row + one restore.
  const returnOrder = await createCodOrder(customer("0559900053"), [
    { productId: productB, quantity: 1 },
  ]);
  orderIds.push(returnOrder.id);
  const beforeWebhookReturn = await inventoryOf(productB);
  const returnShipmentRes = await q(
    connA,
    `INSERT INTO order_shipments
       (order_id, merchant_id, carrier_id, tracking_number, external_status_label,
        status_history, sync_method, check_count)
     VALUES (?, ?, 990002, ?, 'initial', '[]', 'webhook', 0)`,
    [returnOrder.id, probeOwnerId, `${PROBE_PREFIX}track-${returnOrder.id}`]
  );
  const [returnShipment] = await dbA
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.id, Number(returnShipmentRes.insertId)))
    .limit(1);
  const returnedComputed = computeShipmentUpdate(
    returnShipment,
    "probe-returned",
    { mapsTo: "returned", isFinal: true },
    new Date()
  );
  await Promise.all([
    applyShipmentStatus(returnShipment, "probe-returned", returnedComputed),
    applyShipmentStatus(returnShipment, "probe-returned", returnedComputed),
  ]);
  const returnRows = await q(
    connA,
    "SELECT COUNT(*) n FROM order_returns WHERE order_id = ?",
    [returnOrder.id]
  );
  check(
    "duplicate returned webhook writes one order_returns row",
    Number(returnRows[0].n) === 1,
    `rows=${returnRows[0].n}`
  );
  check(
    "duplicate returned webhook restores stock once",
    (await inventoryOf(productB)) === beforeWebhookReturn + 1,
    `before=${beforeWebhookReturn} after=${await inventoryOf(productB)}`
  );

  const assignmentRows = await q(
    connA,
    `SELECT orderId, COUNT(DISTINCT confirmationAgentId) n
       FROM store_order_items
      WHERE orderId IN (?)
      GROUP BY orderId`,
    [orderIds.length ? orderIds : [0]]
  );
  check(
    "every probe order carries exactly one assigned agent",
    assignmentRows.every((row: { n: number }) => Number(row.n) === 1),
    `orders=${assignmentRows.length}`
  );
} catch (error) {
  check(
    "live orders concurrency probe completed",
    false,
    error instanceof Error ? error.message : String(error)
  );
} finally {
  const cleanupAllowed = await isProbeStore().catch(() => false);
  if (!cleanupAllowed) {
    check(
      "cleanup skipped: probe store guard failed (no real row touched)",
      !probeStoreId && !probeOwnerId,
      probeStoreId ? `storeId=${probeStoreId}` : "nothing created"
    );
  } else {
    const ids = orderIds.length ? orderIds : [0];
    await q(connA, "DELETE FROM order_shipments WHERE order_id IN (?)", [ids]);
    await q(connA, "DELETE FROM order_profits WHERE order_id IN (?)", [ids]);
    await q(connA, "DELETE FROM order_returns WHERE order_id IN (?)", [ids]);
    await q(connA, "DELETE FROM store_order_items WHERE orderId IN (?)", [ids]);
    await q(connA, "DELETE FROM store_orders WHERE storeId = ?", [probeStoreId]);
    await q(connA, "DELETE FROM offer_products WHERE storeId = ?", [probeStoreId]);
    await q(connA, "DELETE FROM offers WHERE storeId = ?", [probeStoreId]);
    await q(
      connA,
      "DELETE FROM store_product_variants WHERE productId IN (?, ?, ?, ?, ?)",
      [productA, productB, productC, productD, productE]
    );
    await q(connA, "DELETE FROM store_products WHERE storeId = ?", [probeStoreId]);
    await q(
      connA,
      "DELETE FROM call_center_agent_products WHERE agentId IN (?, ?)",
      [agent1 || 0, agent2 || 0]
    );
    await q(connA, "DELETE FROM call_center_agents WHERE storeId = ?", [
      probeStoreId,
    ]);
    await q(connA, "DELETE FROM call_center_settings WHERE storeId = ?", [
      probeStoreId,
    ]);
    await q(connA, "DELETE FROM stores WHERE id = ? AND slug = ?", [
      probeStoreId,
      PROBE_SLUG,
    ]);
    await q(connA, "DELETE FROM users WHERE id = ? AND openId = ?", [
      probeOwnerId,
      PROBE_OPEN_ID,
    ]);

    const leftovers: Record<string, number> = {};
    leftovers.orders = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM store_orders WHERE storeId = ?", [
          probeStoreId,
        ])
      )[0].n
    );
    leftovers.items = Number(
      (
        await q(
          connA,
          "SELECT COUNT(*) n FROM store_order_items WHERE orderId IN (?)",
          [ids]
        )
      )[0].n
    );
    leftovers.products = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM store_products WHERE storeId = ?", [
          probeStoreId,
        ])
      )[0].n
    );
    leftovers.offers = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM offers WHERE storeId = ?", [
          probeStoreId,
        ])
      )[0].n
    );
    leftovers.agents = Number(
      (
        await q(
          connA,
          "SELECT COUNT(*) n FROM call_center_agents WHERE storeId = ?",
          [probeStoreId]
        )
      )[0].n
    );
    leftovers.shipments = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM order_shipments WHERE order_id IN (?)", [
          ids,
        ])
      )[0].n
    );
    leftovers.store = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM stores WHERE id = ?", [
          probeStoreId,
        ])
      )[0].n
    );
    leftovers.owner = Number(
      (
        await q(connA, "SELECT COUNT(*) n FROM users WHERE id = ?", [
          probeOwnerId,
        ])
      )[0].n
    );
    check(
      "zero probe rows remain (cleanup verified)",
      Object.values(leftovers).every(value => value === 0),
      JSON.stringify(leftovers)
    );
  }
  await connA.end();
  await connB.end();
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
