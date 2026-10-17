import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = () => readFileSync("server/db.ts", "utf8");
const callCenterSource = () => readFileSync("server/callCenterDb.ts", "utf8");
const routerSource = () => readFileSync("server/routers/orders.ts", "utf8");

describe("order race guards (source-level)", () => {
  it("reserves stock atomically with a >= predicate and affectedRows check", () => {
    const source = dbSource();
    const reserve = source.slice(
      source.indexOf("async function reserveOrderStock"),
      source.indexOf("export async function createCodOrder")
    );
    expect(reserve).toContain("gte(storeProductVariants.stock, quantity)");
    expect(reserve).toContain("gte(storeProducts.inventory, quantity)");
    expect(reserve).toContain("sql`${storeProductVariants.stock} - ${quantity}`");
    expect(reserve).toContain("sql`${storeProducts.inventory} - ${quantity}`");
    expect(reserve).toContain("affectedRows(update) !== 1");
  });

  it("runs stock, order, items, offers and assignment in one transaction", () => {
    const source = dbSource();
    const create = source.slice(
      source.indexOf("export async function createCodOrder"),
      source.indexOf("type DigitalOrderLineInput")
    );
    expect(create).toContain("reserveOrderStock(");
    expect(create).toContain("inventoryDeductedAt: stockReserved");
    expect(create).toContain("insertOrderWithUniqueNumber(");
    expect(create).toContain("assignNewOrderToCallCenterAgentInTransaction");
    expect(create).toContain("usedCount: line.quantityOffer.usedCount + line.quantity");
    // Assignment is inside the transaction, so the router must not fire a
    // second, out-of-transaction assignment for createCod.
    expect(routerSource()).not.toContain("void assignNewOrderToCallCenterAgent({\n              storeId,\n              orderId: result.id");
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

  it("restores stock on every terminal non-delivered status", () => {
    const source = dbSource();
    expect(source).toContain("if (shouldRestoreInventory(fulfillmentStatus))");
    expect(source).toContain("shouldRestoreInventory(data.fulfillmentStatus)");
  });

  it("serialises round-robin assignment with FOR UPDATE and claims the at_carrier deduction", () => {
    const source = callCenterSource();
    expect(source).toContain('.for("update")');
    expect(source).toContain("assignNewOrderToCallCenterAgentInTransaction");
    const inventory = dbSource().slice(
      dbSource().indexOf('if (event === "at_carrier")'),
      dbSource().indexOf('if (!order.inventoryDeductedAt || order.inventoryRestoredAt)')
    );
    expect(inventory).toContain("if (order.inventoryDeductedAt) return order;");
    expect(inventory).toContain("isNull(storeOrders.inventoryDeductedAt)");
    expect(dbSource()).toContain("isNull(storeOrders.inventoryRestoredAt)");
  });
});
