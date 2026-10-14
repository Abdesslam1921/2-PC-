import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeUpsellUnitPrice,
  selectCodUnitPrice,
} from "./orderPricing";

describe("computeUpsellUnitPrice — recomputed from DB config only", () => {
  it("uses the fixed upsell price when configured", () => {
    expect(
      computeUpsellUnitPrice({ upsellPrice: "2500.00" }, "4000.00")
    ).toBe("2500.00");
  });

  it("subtracts a fixed discount amount from the upsell product price", () => {
    expect(
      computeUpsellUnitPrice({ upsellDiscountAmount: "1500.00" }, "4000.00")
    ).toBe("2500.00");
  });

  it("applies a percentage discount to the upsell product price", () => {
    expect(
      computeUpsellUnitPrice({ upsellDiscountPercent: 25 }, "4000.00")
    ).toBe("3000.00");
  });

  it("never returns a negative price", () => {
    expect(
      computeUpsellUnitPrice({ upsellDiscountAmount: "9999.00" }, "4000.00")
    ).toBe("0.00");
  });

  it("returns null when no upsell pricing is configured", () => {
    expect(computeUpsellUnitPrice({}, "4000.00")).toBeNull();
  });
});

describe("selectCodUnitPrice — DB-resolved sources only", () => {
  it("prefers a quantity offer's fixed price", () => {
    expect(
      selectCodUnitPrice({
        quantityOfferPrice: "9000.00",
        isUpsell: false,
        variantPrice: "3200.00",
        productPrice: "3500.00",
      })
    ).toBe("9000.00");
  });

  it("uses the chosen variant price over the base product price", () => {
    expect(
      selectCodUnitPrice({
        isUpsell: false,
        variantPrice: "3200.00",
        productPrice: "3500.00",
      })
    ).toBe("3200.00");
  });

  it("falls back to the base product price", () => {
    expect(
      selectCodUnitPrice({ isUpsell: false, productPrice: "3500.00" })
    ).toBe("3500.00");
  });

  it("uses the recomputed upsell price for an upsell line", () => {
    expect(
      selectCodUnitPrice({ isUpsell: true, upsellPrice: "2500.00" })
    ).toBe("2500.00");
  });

  it("rejects an upsell line with no configured upsell price", () => {
    expect(selectCodUnitPrice({ isUpsell: true, upsellPrice: null })).toBeNull();
  });
});

/**
 * Source-level guard: `orders.createCod` must never read a client price. This
 * keeps the S2 fix from silently regressing.
 */
describe("public checkout never trusts a client-supplied amount", () => {
  it("createCodOrder recomputes upsell prices and does not use line.priceOverride as a price", () => {
    const dbSource = readFileSync("server/db.ts", "utf8");
    expect(dbSource).not.toContain("line.priceOverride ??");
    expect(dbSource).not.toMatch(/unitPrice\s*=\s*line\.priceOverride/);
    expect(dbSource).toContain("computeUpsellUnitPrice(");
  });

  it("the checkout input schema exposes no price/total/deliveryFee/discountAmount field", () => {
    const routerSource = readFileSync("server/routers/orders.ts", "utf8");
    const checkoutBlock = routerSource.slice(
      routerSource.indexOf("const checkoutInput"),
      routerSource.indexOf("export const ordersRouter")
    );
    expect(checkoutBlock).not.toMatch(/\bprice:\s*z\./);
    expect(checkoutBlock).not.toMatch(/\btotal:\s*z\./);
    expect(checkoutBlock).not.toMatch(/\bdeliveryFee:\s*z\./);
    expect(checkoutBlock).not.toMatch(/\bdiscountAmount:\s*z\./);
  });
});
