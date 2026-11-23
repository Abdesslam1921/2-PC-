import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { storeProductImages, storeProductVariants } from "../drizzle/schema";
import { toPublicProduct } from "./db";

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
] as const;

describe("public product payload", () => {
  it("never exposes costing fields or digital file references", () => {
    const row = {
      id: 30001,
      storeId: 7,
      title: "Public product",
      price: "1200.00",
      currency: "DZD",
      productKind: "digital",
      status: "active",
      digitalFileName: "guide.pdf",
      digitalFileSize: 1234,
      digitalFileStorageKey: "digital-products/7/secret_abc.pdf",
      digitalFileUrl: "/manus-storage/digital-products/7/secret_abc.pdf",
      costPerItem: "500.00",
      costAccountingMode: "manual",
      costQuantity: 10,
      productCostTotal: "5000.00",
      packagingCostPerItem: "20.00",
      packagingCostTotal: "200.00",
      procurementDeliveryCostPerItem: "50.00",
      procurementDeliveryCostTotal: "500.00",
      returnCostPerOrder: "100.00",
      returnDeliveryFree: true,
    };

    const pub = toPublicProduct(row as never) as Record<string, unknown>;

    for (const field of COST_FIELDS) {
      expect(pub).not.toHaveProperty(field);
    }
    expect(pub).not.toHaveProperty("digitalFileStorageKey");
    expect(pub).not.toHaveProperty("digitalFileUrl");
    // What the storefront legitimately needs stays intact.
    expect(pub.id).toBe(30001);
    expect(pub.storeId).toBe(7);
    expect(pub.title).toBe("Public product");
    expect(pub.digitalFileName).toBe("guide.pdf");
  });

  it("keeps tenant filters in the batched public queries", () => {
    const source = readFileSync("server/db.ts", "utf8");
    const listStart = source.indexOf("export async function listPublicStoreProducts");
    const listBody = source.slice(listStart, listStart + 900);
    expect(listBody).toContain("eq(storeProducts.storeId, storeId)");

    const offersStart = source.indexOf(
      "export async function listQuantityOffersForProducts"
    );
    const offersBody = source.slice(offersStart, offersStart + 1200);
    expect(offersBody).toContain("eq(offers.storeId, storeId)");
    expect(offersBody).toContain(
      "inArray(offerProducts.productId, productIds)"
    );

    // Images/variants have no storeId column; they are scoped by the product
    // IDs taken from the already tenant-filtered product list.
    expect("storeId" in storeProductImages).toBe(false);
    expect("storeId" in storeProductVariants).toBe(false);
    expect(source).not.toMatch(
      /products\.map\(product =>\s*getPublicStoreProduct\(/
    );
  });
});
