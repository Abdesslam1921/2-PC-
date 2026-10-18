/**
 * LIVE verification of the confirmation-time inventory policy and order races
 * against the REAL database.
 *
 * Two explicit MySQL connections create a dedicated probe owner/store/products/
 * offers/agents, then exercise the production functions concurrently:
 *   (a) `new`/`abandoned` never deduct; the first confirmed-or-later transition
 *       deducts once, atomically, and names the product on shortage,
 *   (b) unique order numbers under concurrent inserts,
 *   (c) round-robin Call Center assignment without corrupting the rotation,
 *   (d) double submit (same phone + same lines) creating ONE order,
 *   (e) createCod atomicity (order + items + offer usedCount + assignment),
 *   (f) manual confirmed orders deduct at creation,
 *   (g) return/cancel restores once; duplicate/concurrent webhooks do not
 *       deduct or restore twice; order_profits/order_returns stay single rows.
 *
 * SAFETY: never reads, writes or deletes a real store's rows. Every probe row
 * carries the dedicated `probesforder` identity and is created by this run;
 * cleanup deletes exactly those ids (guarded by store id + ownerId + slug) and
 * verifies zero rows remain.
 *
 * Usage: pnpm exec tsx scripts/orders-concurrency-check.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createConnection, type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import {
  createCodOrder,
  createManualOrder,
  updateStoreOrderStatus,
} from "../server/db";
import { applyShipmentStatus } from "../server/forshipDb";
import { normalizeAlgerianMobile } from "../server/phone";
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
const manualOrderIds: number[] = [];

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

const createOffer = async (name: string, productId: number, maxUses: number) => {
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

const setInventory = async (productId: number, value: number) => {
  await q(connA, "UPDATE store_products SET inventory = ? WHERE id = ?", [
    value,
    productId,
  ]);
};

const setVariantStock = async (variantId: number, value: number) => {
  await q(connA, "UPDATE store_product_variants SET stock = ? WHERE id = ?", [
    value,
    variantId,
  ]);
};

const variantStockOf = async (variantId: number) => {
  const rows = await q(
    connA,
    "SELECT stock FROM store_product_variants WHERE id = ?",
    [variantId]
  );
  return Number(rows[0]?.stock ?? -1);
};

const orderRow = async (orderId: number) => {
  const rows = await q(
    connA,
    `SELECT fulfillmentStatus, inventoryDeductedAt, inventoryRestoredAt
       FROM store_orders WHERE id = ?`,
    [orderId]
  );
  return rows[0];
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

const confirm = (orderId: number) =>
  updateStoreOrderStatus(probeStoreId!, orderId, "confirmed");

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

  // (a1) new does not deduct; the first confirmed transition deducts once.
  const single = await createCodOrder(customer("0559900101"), [
    { productId: productA, quantity: 1 },
  ]);
  orderIds.push(single.id);
  check(
    "new order does not deduct inventory",
    (await inventoryOf(productA)) === 1 &&
      (await orderRow(single.id)).inventoryDeductedAt == null,
    `inventory=${await inventoryOf(productA)}`
  );
  await confirm(single.id);
  const afterConfirm = await orderRow(single.id);
  check(
    "confirmed transition deducts once",
    (await inventoryOf(productA)) === 0 &&
      afterConfirm.fulfillmentStatus === "confirmed" &&
      afterConfirm.inventoryDeductedAt != null,
    `inventory=${await inventoryOf(productA)}`
  );
  const deductedAt = String(afterConfirm.inventoryDeductedAt);
  for (const status of ["processing", "shipped", "delivered"] as const) {
    await updateStoreOrderStatus(probeStoreId, single.id, status);
  }
  const afterChain = await orderRow(single.id);
  check(
    "later statuses do not deduct again",
    (await inventoryOf(productA)) === 0 &&
      String(afterChain.inventoryDeductedAt) === deductedAt &&
      afterChain.inventoryRestoredAt == null,
    `inventory=${await inventoryOf(productA)}`
  );

  // (a2) Soft check passes at creation; a later shortage still blocks the
  // human confirmation atomically.
  await setInventory(productA, 2);
  const race = await Promise.all([
    createCodOrder(customer("0559900102"), [{ productId: productA, quantity: 1 }]),
    createCodOrder(customer("0559900103"), [{ productId: productA, quantity: 1 }]),
  ]);
  race.forEach(order => orderIds.push(order.id));
  check(
    "two new orders pass the soft check at stock=2 without reserving",
    (await inventoryOf(productA)) === 2 &&
      race.every(order => order.id > 0)
  );
  await setInventory(productA, 1); // simulate another sale after creation
  const confirmations = await Promise.allSettled(
    race.map(order => confirm(order.id))
  );
  const confirmedWins = confirmations.filter(r => r.status === "fulfilled");
  const confirmErrors = confirmations.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  const shortageMessage =
    confirmErrors[0]?.reason instanceof Error
      ? confirmErrors[0].reason.message
      : "";
  check(
    "confirming the last unit: exactly one wins",
    confirmedWins.length === 1 && confirmErrors.length === 1,
    `wins=${confirmedWins.length} errors=${confirmErrors.length}`
  );
  check(
    "shortage message names the product",
    shortageMessage.includes("Probe A"),
    shortageMessage
  );
  const raceStates = await Promise.all(race.map(order => orderRow(order.id)));
  check(
    "the loser stays new and is not marked deducted",
    raceStates.filter(state => state.fulfillmentStatus === "new").length === 1 &&
      raceStates.filter(state => state.inventoryDeductedAt == null).length === 1
  );

  const softReject = await Promise.allSettled([
    createCodOrder(customer("0559900104"), [{ productId: productD, quantity: 1 }]),
  ]);
  check(
    "soft check rejects creation when stock is below the quantity",
    softReject[0].status === "rejected" &&
      String(
        softReject[0].status === "rejected" ? softReject[0].reason : ""
      ).includes("Probe D")
  );

  // (a3) Multi-line all-or-nothing at confirmation.
  await setInventory(productC, 5);
  await setInventory(productD, 1);
  const multi = await createCodOrder(customer("0559900105"), [
    { productId: productC, quantity: 1 },
    { productId: productD, quantity: 1 },
  ]);
  orderIds.push(multi.id);
  check(
    "multi-line order passes the soft check at creation",
    (await inventoryOf(productC)) === 5
  );
  await setInventory(productD, 0); // shortage appears before confirmation
  const multiConfirm = await Promise.allSettled([confirm(multi.id)]);
  check(
    "multi-line confirmation fails when one line is out of stock",
    multiConfirm[0].status === "rejected"
  );
  check(
    "multi-line failure leaves the first line's stock untouched",
    (await inventoryOf(productC)) === 5,
    `inventory=${await inventoryOf(productC)}`
  );
  check(
    "multi-line failure leaves the order new and undeducted",
    (await orderRow(multi.id)).fulfillmentStatus === "new" &&
      (await orderRow(multi.id)).inventoryDeductedAt == null
  );

  // (a4) Variant last unit at confirmation.
  const variantRace = await Promise.all([
    createCodOrder(customer("0559900105"), [
      { productId: productE, variantId: variantE, quantity: 1 },
    ]),
    createCodOrder(customer("0559900106"), [
      { productId: productE, variantId: variantE, quantity: 1 },
    ]),
  ]);
  variantRace.forEach(order => orderIds.push(order.id));
  await setVariantStock(variantE, 1); // shortage appears before confirmation
  const variantConfirms = await Promise.allSettled(
    variantRace.map(order => confirm(order.id))
  );
  check(
    "variant last unit: exactly one confirmation wins",
    variantConfirms.filter(r => r.status === "fulfilled").length === 1 &&
      variantConfirms.filter(r => r.status === "rejected").length === 1
  );
  check(
    "variant stock cannot go negative",
    (await variantStockOf(variantE)) === 0,
    `stock=${await variantStockOf(variantE)}`
  );

  // (a5) Manual orders: confirmed deducts at creation; new does not.
  const beforeManual = await inventoryOf(productB);
  const manualConfirmed = await createManualOrder(probeStoreId, {
    productId: productB,
    quantity: 2,
    customerName: "Probe Manual",
    customerPhone: "0559900107",
    wilaya: "الجزائر",
    fulfillmentStatus: "confirmed",
  });
  orderIds.push(manualConfirmed.orderId);
  manualOrderIds.push(manualConfirmed.orderId);
  check(
    "manual order created as confirmed deducts at creation",
    (await inventoryOf(productB)) === beforeManual - 2 &&
      (await orderRow(manualConfirmed.orderId)).inventoryDeductedAt != null,
    `before=${beforeManual} after=${await inventoryOf(productB)}`
  );
  const manualNew = await createManualOrder(probeStoreId, {
    productId: productB,
    quantity: 1,
    customerName: "Probe Manual New",
    customerPhone: "0559900108",
    wilaya: "الجزائر",
    fulfillmentStatus: "new",
  });
  orderIds.push(manualNew.orderId);
  manualOrderIds.push(manualNew.orderId);
  check(
    "manual order created as new does not deduct",
    (await inventoryOf(productB)) === beforeManual - 2 &&
      (await orderRow(manualNew.orderId)).inventoryDeductedAt == null
  );
  const manualInvalid = await Promise.allSettled([
    createManualOrder(probeStoreId, {
      productId: productD,
      quantity: 1,
      customerName: "Probe Manual OOS",
      customerPhone: "0559900109",
      wilaya: "الجزائر",
      fulfillmentStatus: "confirmed",
    }),
  ]);
  check(
    "manual confirmed order with no stock is rejected and names the product",
    manualInvalid[0].status === "rejected" &&
      String(
        manualInvalid[0].status === "rejected"
          ? manualInvalid[0].reason
          : ""
      ).includes("Probe D")
  );

  const manualNewInvalid = await Promise.allSettled([
    createManualOrder(probeStoreId, {
      productId: productD,
      quantity: 1,
      customerName: "Probe Manual New OOS",
      customerPhone: "0559900109",
      wilaya: "???????",
      fulfillmentStatus: "new",
    }),
  ]);
  check(
    "manual new order is soft-checked at creation too",
    manualNewInvalid[0].status === "rejected" &&
      String(
        manualNewInvalid[0].status === "rejected"
          ? manualNewInvalid[0].reason
          : ""
      ).includes("Probe D")
  );

  // (a6) Cancel before shipping restores once; cancel after shipping does not.
  const cancelOrder = await createCodOrder(customer("0559900110"), [
    { productId: productB, quantity: 2 },
  ]);
  orderIds.push(cancelOrder.id);
  await confirm(cancelOrder.id);
  const beforeCancel = await inventoryOf(productB);
  await Promise.all([
    updateStoreOrderStatus(probeStoreId, cancelOrder.id, "cancelled"),
    updateStoreOrderStatus(probeStoreId, cancelOrder.id, "cancelled"),
  ]);
  check(
    "cancel of a confirmed-not-shipped order restores stock once",
    (await inventoryOf(productB)) === beforeCancel + 2 &&
      (await orderRow(cancelOrder.id)).inventoryRestoredAt != null,
    `before=${beforeCancel} after=${await inventoryOf(productB)}`
  );

  const shippedCancel = await createCodOrder(customer("0559900111"), [
    { productId: productB, quantity: 2 },
  ]);
  orderIds.push(shippedCancel.id);
  await confirm(shippedCancel.id);
  await updateStoreOrderStatus(probeStoreId, shippedCancel.id, "at_carrier");
  const beforeShippedCancel = await inventoryOf(productB);
  await updateStoreOrderStatus(probeStoreId, shippedCancel.id, "cancelled");
  check(
    "cancel after at_carrier does not restore stock",
    (await inventoryOf(productB)) === beforeShippedCancel &&
      (await orderRow(shippedCancel.id)).inventoryRestoredAt == null,
    `before=${beforeShippedCancel} after=${await inventoryOf(productB)}`
  );

  // (a7) Returned restores once, even when applied repeatedly/concurrently.
  const returnOrder = await createCodOrder(customer("0559900112"), [
    { productId: productB, quantity: 2 },
  ]);
  orderIds.push(returnOrder.id);
  await confirm(returnOrder.id);
  const beforeReturn = await inventoryOf(productB);
  await Promise.all([
    updateStoreOrderStatus(probeStoreId, returnOrder.id, "returned"),
    updateStoreOrderStatus(probeStoreId, returnOrder.id, "returned"),
  ]);
  await updateStoreOrderStatus(probeStoreId, returnOrder.id, "returned");
  check(
    "returned restores stock once",
    (await inventoryOf(productB)) === beforeReturn + 2,
    `before=${beforeReturn} after=${await inventoryOf(productB)}`
  );

  // (b) Unique order numbers + (c) balanced rotation under pressure.
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      createCodOrder(customer(`05599002${String(index + 20).padStart(2, "0")}`), [
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
    `agent1=${agent1Count}/${agent1} agent2=${agent2Count}/${agent2}`
  );

  // (d) Double submit: same phone + same line creates ONE order.
  const doublePhone = "0559900130";
  const beforeDouble = await inventoryOf(productB);
  const doubleSubmit = await Promise.all([
    createCodOrder(customer(doublePhone), [{ productId: productB, quantity: 1 }]),
    createCodOrder(customer(doublePhone), [{ productId: productB, quantity: 1 }]),
  ]);
  orderIds.push(doubleSubmit[0].id);
  check(
    "double submit returns the same order id (idempotent)",
    doubleSubmit[0].id === doubleSubmit[1].id &&
      (await ordersForPhone(doublePhone)).length === 1,
    doubleSubmit.map(order => order.id).join(",")
  );
  check(
    "double submit does not deduct before confirmation",
    (await inventoryOf(productB)) === beforeDouble
  );
  await confirm(doubleSubmit[0].id);
  check(
    "confirming the deduplicated order deducts exactly one unit",
    (await inventoryOf(productB)) === beforeDouble - 1
  );

  // (e) Quantity offer multiplier: creation reserves usage, confirmation
  // deducts the correct number of inventory units (2 per offer).
  const beforeOfferC = await inventoryOf(productC);
  const offerOrder = await createCodOrder(customer("0559900140"), [
    { productId: productC, offerId: offerMax5, quantity: 1 },
  ]);
  orderIds.push(offerOrder.id);
  const offerRow = (
    await q(connA, "SELECT usedCount FROM offers WHERE id = ?", [offerMax5])
  )[0];
  check(
    "quantity offer usage is consumed at creation",
    Number(offerRow.usedCount) === 1 && (await inventoryOf(productC)) === beforeOfferC
  );
  await confirm(offerOrder.id);
  check(
    "confirmation deducts the offer multiplier (2 units)",
    (await inventoryOf(productC)) === beforeOfferC - 2,
    `before=${beforeOfferC} after=${await inventoryOf(productC)}`
  );

  // (e2) maxUses=1 race: one order survives; the loser rolls back fully.
  const beforeRaceC = await inventoryOf(productC);
  const offerRace = await Promise.allSettled([
    createCodOrder(customer("0559900141"), [
      { productId: productC, offerId: offerMax1, quantity: 1 },
    ]),
    createCodOrder(customer("0559900142"), [
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
    "maxUses race: usedCount=1 and no stock deduction happened at creation",
    Number(offerUsed.usedCount) === 1 &&
      (await inventoryOf(productC)) === beforeRaceC,
    `used=${offerUsed.usedCount} inventory=${await inventoryOf(productC)}`
  );

  // (g1) Duplicate delivered webhook: deduct once + one order_profits row.
  const deliveredOrder = await createCodOrder(customer("0559900150"), [
    { productId: productB, quantity: 1 },
  ]);
  orderIds.push(deliveredOrder.id);
  const beforeDelivered = await inventoryOf(productB);
  const deliveredShipmentRes = await q(
    connA,
    `INSERT INTO order_shipments
       (order_id, merchant_id, carrier_id, tracking_number, external_status_label,
        status_history, sync_method, check_count)
     VALUES (?, ?, 990001, ?, 'initial', '[]', 'webhook', 0)`,
    [deliveredOrder.id, probeOwnerId, `${PROBE_PREFIX}track-${deliveredOrder.id}`]
  );
  const [deliveredShipment] = await dbA
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.id, Number(deliveredShipmentRes.insertId)))
    .limit(1);
  const deliveredComputed = computeShipmentUpdate(
    deliveredShipment,
    "probe-delivered",
    { mapsTo: "delivered", isFinal: true },
    new Date()
  );
  await Promise.all([
    applyShipmentStatus(deliveredShipment, "probe-delivered", deliveredComputed),
    applyShipmentStatus(deliveredShipment, "probe-delivered", deliveredComputed),
  ]);
  const profitRows = await q(
    connA,
    "SELECT COUNT(*) n FROM order_profits WHERE order_id = ?",
    [deliveredOrder.id]
  );
  check(
    "duplicate delivered webhook writes one order_profits row",
    Number(profitRows[0].n) === 1,
    `rows=${profitRows[0].n}`
  );
  check(
    "delivered webhook deducts stock once",
    (await inventoryOf(productB)) === beforeDelivered - 1 &&
      (await orderRow(deliveredOrder.id)).inventoryDeductedAt != null
  );

  // (g1b) A carrier "delivered" transition must NOT be rejected on a shortage:
  // record the status + a visible stock warning instead.
  await setInventory(productA, 1);
  const shortDelivered = await createCodOrder(customer("0559900152"), [
    { productId: productA, quantity: 1 },
  ]);
  orderIds.push(shortDelivered.id);
  await setInventory(productA, 0);
  const shortShipmentRes = await q(
    connA,
    `INSERT INTO order_shipments
       (order_id, merchant_id, carrier_id, tracking_number, external_status_label,
        status_history, sync_method, check_count)
     VALUES (?, ?, 990003, ?, 'initial', '[]', 'webhook', 0)`,
    [shortDelivered.id, probeOwnerId, `${PROBE_PREFIX}track-${shortDelivered.id}`]
  );
  const [shortShipment] = await dbA
    .select()
    .from(orderShipments)
    .where(eq(orderShipments.id, Number(shortShipmentRes.insertId)))
    .limit(1);
  const shortComputed = computeShipmentUpdate(
    shortShipment,
    "probe-delivered-short",
    { mapsTo: "delivered", isFinal: true },
    new Date()
  );
  const shortDeliveryResult = await Promise.allSettled([
    applyShipmentStatus(shortShipment, "probe-delivered-short", shortComputed),
  ]);
  const shortOrder = await orderRow(shortDelivered.id);
  const shortOffers = (
    await q(connA, "SELECT appliedOffers FROM store_orders WHERE id = ?", [
      shortDelivered.id,
    ])
  )[0]?.appliedOffers;
  check(
    "carrier delivered transition is not rejected on stock shortage",
    shortDeliveryResult[0].status === "fulfilled" &&
      shortOrder.fulfillmentStatus === "delivered"
  );
  check(
    "carrier shortage persists a visible stock warning",
    shortOrder.inventoryDeductedAt != null &&
      JSON.stringify(shortOffers).includes("stock_warning") &&
      JSON.stringify(shortOffers).includes("Probe A"),
    JSON.stringify(shortOffers)
  );

  // (g2) Duplicate returned webhook: restore once + one order_returns row.
  const returnWebhookOrder = await createCodOrder(customer("0559900151"), [
    { productId: productB, quantity: 1 },
  ]);
  orderIds.push(returnWebhookOrder.id);
  await confirm(returnWebhookOrder.id);
  const beforeWebhookReturn = await inventoryOf(productB);
  const returnShipmentRes = await q(
    connA,
    `INSERT INTO order_shipments
       (order_id, merchant_id, carrier_id, tracking_number, external_status_label,
        status_history, sync_method, check_count)
     VALUES (?, ?, 990002, ?, 'initial', '[]', 'webhook', 0)`,
    [
      returnWebhookOrder.id,
      probeOwnerId,
      `${PROBE_PREFIX}track-${returnWebhookOrder.id}`,
    ]
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
    [returnWebhookOrder.id]
  );
  check(
    "duplicate returned webhook writes one order_returns row",
    Number(returnRows[0].n) === 1,
    `rows=${returnRows[0].n}`
  );
  check(
    "duplicate returned webhook restores stock once",
    (await inventoryOf(productB)) === beforeWebhookReturn + 1
  );

  check(
    "second connection observes the same final stock",
    Number(
      (
        await q(connB, "SELECT inventory FROM store_products WHERE id = ?", [
          productB,
        ])
      )[0].inventory
    ) === (await inventoryOf(productB))
  );

  const lockPhone = normalizeAlgerianMobile("0559900199") ?? "0559900199";
  const lockName = `order-idem-${createHash("sha1").update(lockPhone).digest("hex")}`;
  const lockFailure = await Promise.allSettled([
    createCodOrder(customer(lockPhone), []),
  ]);
  const lockProbeConn = await createConnection(url);
  const [lockProbe] = await q(
    lockProbeConn,
    "SELECT GET_LOCK(?, 1) AS acquired",
    [lockName]
  );
  const lockRow = Array.isArray(lockProbe) ? lockProbe[0] : lockProbe;
  const lockReleased = Number(lockRow?.acquired) === 1;
  if (lockReleased)
    await q(lockProbeConn, "SELECT RELEASE_LOCK(?)", [lockName]);
  await lockProbeConn.end();
  const lockOk =
    lockFailure[0].status === "rejected" && lockReleased === true;
  check(
    "phone lock is released in finally after an error",
    lockOk,
    `lockOk=${lockOk} status=${lockFailure[0].status} released=${lockReleased} probe=${JSON.stringify(lockProbe)}`
  );

  const assignedIds = orderIds.filter(id => !manualOrderIds.includes(id));
  const assignmentRows = await q(
    connA,
    `SELECT orderId, COUNT(DISTINCT confirmationAgentId) n
       FROM store_order_items
      WHERE orderId IN (?)
      GROUP BY orderId`,
    [assignedIds.length ? assignedIds : [0]]
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
