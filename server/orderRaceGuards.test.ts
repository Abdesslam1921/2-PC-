import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = () => readFileSync("server/db.ts", "utf8");
const callCenterSource = () => readFileSync("server/callCenterDb.ts", "utf8");
const routerSource = () => readFileSync("server/routers/orders.ts", "utf8");
const forshipSource = () => readFileSync("server/forshipDb.ts", "utf8");

function sliceBetween(source: string, from: string, to: string) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

describe("order race guards (source-level)", () => {
  it("does NOT deduct inventory when a COD order is created as new", () => {
    const create = sliceBetween(
      dbSource(),
      "export async function createCodOrder",
      "type DigitalOrderLineInput"
    );
    expect(create).not.toContain("reserveOrderStock");
    expect(create).not.toContain("inventoryDeductedAt");
    expect(create).not.toContain("remaining <");
  });

  it("deducts atomically on the first confirmed-or-later status", () => {
    const deduct = sliceBetween(
      dbSource(),
      "async function deductOrderInventoryInTransaction",
      "async function restoreOrderInventoryInTransaction"
    );
    expect(deduct).toContain("gte(storeProductVariants.stock, quantity)");
    expect(deduct).toContain("gte(storeProducts.inventory, quantity)");
    expect(deduct).toContain("sql`${storeProductVariants.stock} - ${quantity}`");
    expect(deduct).toContain("sql`${storeProducts.inventory} - ${quantity}`");
    expect(deduct).toContain("affectedRows(update) !== 1");
    expect(deduct).toContain("inventoryDeductedAt: now");
    expect(deduct).toContain("inventoryRestoredAt: null");
  });

  it("locks the order row and updates stock + status in one transaction", () => {
    const status = sliceBetween(
      dbSource(),
      "export async function updateStoreOrderStatus",
      "export async function deleteArchivedOrder"
    );
    expect(status).toContain("db.transaction");
    expect(status).toContain('.for("update")');
    expect(status).toContain("applyOrderInventoryForStatus");
    expect(status.indexOf("applyOrderInventoryForStatus")).toBeLessThan(
      status.indexOf("fulfillmentStatus }")
    );
  });

  it("restores on return, and on cancellation only before shipping", () => {
    const apply = sliceBetween(
      dbSource(),
      "async function applyOrderInventoryForStatus",
      "export async function applyOrderInventoryLifecycle"
    );
    expect(apply).toContain('targetStatus === "returned"');
    expect(apply).toContain("isShippedOrBeyond(order.fulfillmentStatus)");
    expect(apply).toContain("!shippedOrBeyond");
    expect(apply).toContain("inventoryRestoredAt");
  });

  it("deducts a manual confirmed order at creation, but not new/abandoned", () => {
    const manual = sliceBetween(
      dbSource(),
      "export async function createManualOrder",
      "export async function clearAbandonedOrdersForPhone"
    );
    expect(manual).toContain('fulfillmentStatus === "confirmed"');
    expect(manual).toContain("gte(storeProducts.inventory, quantity)");
    expect(manual).toContain("inventoryDeductedAt: deductAtCreation ? new Date() : null");
    expect(manual).toContain("db.transaction");
  });

  it("routes terminal webhooks through the same locked status transition", () => {
    const handle = sliceBetween(
      forshipSource(),
      "async function handleFinalEvent",
      "async function recordOrderProfit"
    );
    expect(handle).toContain("updateStoreOrderStatus");
    expect(handle).not.toContain("applyOrderInventoryLifecycle");
  });

  it("serialises double submits per phone and returns the existing order", () => {
    const source = dbSource();
    expect(source).toContain("GET_LOCK(?, 10)");
    expect(source).toContain("RELEASE_LOCK(?)");
    expect(source).toContain("findRecentDuplicateOrder(");
    expect(source).toContain("deduplicated: true");
  });

  it("retries a duplicate temporary order number and finalises from the row id", () => {
    const source = dbSource();
    expect(source).toContain("async function insertOrderWithUniqueNumber");
    expect(source).toContain("isDuplicateKeyError(error)");
    expect(source).toContain("async function finalizeOrderNumber");
    expect(source).toContain("orderNumberForId(orderId)");
  });

  it("serialises round-robin assignment with FOR UPDATE and runs it in the order transaction", () => {
    const source = callCenterSource();
    expect(source).toContain('.for("update")');
    expect(source).toContain("assignNewOrderToCallCenterAgentInTransaction");
    expect(dbSource()).toContain("assignNewOrderToCallCenterAgentInTransaction");
    expect(routerSource()).not.toContain("void assignNewOrderToCallCenterAgent({\n              storeId,\n              orderId: result.id");
  });
});
