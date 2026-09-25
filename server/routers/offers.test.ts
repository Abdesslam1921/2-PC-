import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import {
  MAX_DISCOUNT_PERCENT,
  computeOfferPricing,
  offerUnavailableReason,
} from "../../shared/offers";

const mocks = vi.hoisted(() => ({
  listOffersWithDetails: vi.fn(),
  getOfferDetails: vi.fn(),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
  deleteOffer: vi.fn(),
  setOfferProducts: vi.fn(),
  setOfferOrder: vi.fn(),
  sumProductsPrice: vi.fn(),
  listPublicOffers: vi.fn(),
  getPublicOfferBySlug: vi.fn(),
}));

vi.mock("../db", () => ({
  listOffersWithDetails: mocks.listOffersWithDetails,
  getOfferDetails: mocks.getOfferDetails,
  createOffer: mocks.createOffer,
  updateOffer: mocks.updateOffer,
  deleteOffer: mocks.deleteOffer,
  setOfferProducts: mocks.setOfferProducts,
  setOfferOrder: mocks.setOfferOrder,
  sumProductsPrice: mocks.sumProductsPrice,
  listPublicOffers: mocks.listPublicOffers,
  getPublicOfferBySlug: mocks.getPublicOfferBySlug,
}));

const offer = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 5,
  storeId: 30001,
  name: "باقة الصيف",
  slug: "summer",
  isActive: true,
  discountType: "percent" as const,
  discountValue: "10.00",
  freeDelivery: false,
  ...over,
});

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  productId: 1,
  quantity: 1,
  title: "منتج",
  price: "1000.00",
  status: "active" as const,
  productKind: "physical" as const,
  inventory: 10,
  trackInventory: true,
  continueSelling: false,
  ...over,
});

function makeContext(storeId: number | null): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "o",
      name: "Owner",
      email: "o@example.com",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    store: storeId ? { id: storeId } : null,
    req: { headers: {}, protocol: "https", hostname: "localtest.me" },
    res: {},
  } as unknown as TrpcContext;
}

describe("offer pricing (single source of truth)", () => {
  it("percent: bundle = sum − percent, saving reported", () => {
    const pricing = computeOfferPricing(
      { discountType: "percent", discountValue: "25", freeDelivery: true },
      [{ quantity: 2, price: "1000" }, { quantity: 1, price: "500" }]
    );
    expect(pricing.originalTotal).toBe(2500);
    expect(pricing.discountAmount).toBe(625);
    expect(pricing.bundlePrice).toBe(1875);
    expect(pricing.savingPercent).toBe(25);
    expect(pricing.freeDelivery).toBe(true);
  });

  it("amount: subtracts the fixed value, never negative", () => {
    const pricing = computeOfferPricing(
      { discountType: "amount", discountValue: "99999", freeDelivery: false },
      [{ quantity: 1, price: "1000" }]
    );
    expect(pricing.bundlePrice).toBeLessThanOrEqual(0);
    // such an offer is hidden, never sold
    expect(
      offerUnavailableReason({ isActive: true }, [item()], pricing)
    ).not.toBeNull();
  });

  it("percent is capped at 95%", () => {
    const pricing = computeOfferPricing(
      { discountType: "percent", discountValue: "200", freeDelivery: false },
      [{ quantity: 1, price: "1000" }]
    );
    expect(pricing.discountAmount).toBe((1000 * MAX_DISCOUNT_PERCENT) / 100);
  });

  it("no discount type → sum only", () => {
    const pricing = computeOfferPricing(
      { discountType: null, discountValue: null, freeDelivery: false },
      [{ quantity: 3, price: "100" }]
    );
    expect(pricing.bundlePrice).toBe(300);
    expect(pricing.discountAmount).toBe(0);
  });
});

describe("offer availability (fail-closed, same as out-of-stock)", () => {
  const available = computeOfferPricing(
    { discountType: "percent", discountValue: "10", freeDelivery: false },
    [item(), item({ productId: 2 })]
  );

  it("available when active, 2+ products, published and in stock", () => {
    expect(
      offerUnavailableReason({ isActive: true }, [item(), item({ productId: 2 })], available)
    ).toBeNull();
  });

  it("hidden when the offer is disabled", () => {
    expect(
      offerUnavailableReason({ isActive: false }, [item(), item({ productId: 2 })], available)
    ).toBe("العرض معطّل.");
  });

  it("hidden when a product is unpublished", () => {
    const reason = offerUnavailableReason(
      { isActive: true },
      [item(), item({ productId: 2, status: "draft" })],
      available
    );
    expect(reason).toContain("غير منشور");
  });

  it("hidden when stock is below the bundle quantity", () => {
    const reason = offerUnavailableReason(
      { isActive: true },
      [item({ quantity: 3, inventory: 2 }), item({ productId: 2 })],
      available
    );
    expect(reason).toContain("غير متوفر");
  });

  it("respects continueSelling (keeps selling without stock)", () => {
    expect(
      offerUnavailableReason(
        { isActive: true },
        [item({ quantity: 5, inventory: 0, continueSelling: true }), item({ productId: 2 })],
        available
      )
    ).toBeNull();
  });

  it("hidden when the fixed discount reaches the products' sum", () => {
    const pricing = computeOfferPricing(
      { discountType: "amount", discountValue: "2000", freeDelivery: false },
      [{ quantity: 1, price: "2000" }]
    );
    const reason = offerUnavailableReason(
      { isActive: true },
      [item(), item({ productId: 2 })],
      pricing
    );
    expect(reason).toContain("الخصم");
  });

  it("hidden when a bundle contains a digital product", () => {
    const reason = offerUnavailableReason(
      { isActive: true },
      [item(), item({ productId: 2, productKind: "digital" })],
      available
    );
    expect(reason).toContain("رقمي");
  });
});

describe("offers router — fail-closed + tenant scoping", () => {
  it("publicList is empty without a resolved store", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.offers.publicList()).resolves.toEqual([]);
    expect(mocks.listPublicOffers).not.toHaveBeenCalled();
  });

  it("publicGet refuses without a resolved store", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.offers.publicGet({ slug: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.getPublicOfferBySlug).not.toHaveBeenCalled();
  });

  it("publicGet answers NOT_FOUND for an unavailable offer", async () => {
    mocks.getPublicOfferBySlug.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext(30001));
    await expect(
      caller.offers.publicGet({ slug: "summer" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicOfferBySlug).toHaveBeenCalledWith("summer", 30001);
  });

  it("dashboard operations require a store", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.offers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a percent discount above 95", async () => {
    const caller = appRouter.createCaller(makeContext(30001));
    await expect(
      caller.offers.create({ name: "x", discountType: "percent", discountValue: 99 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createOffer).not.toHaveBeenCalled();
  });

  it("rejects a fixed discount that reaches the products' sum", async () => {
    mocks.getOfferDetails.mockResolvedValueOnce({
      offer: offer({ discountType: undefined, discountValue: undefined }),
      items: [item(), item({ productId: 2 })],
      pricing: computeOfferPricing(
        { discountType: null, discountValue: null, freeDelivery: false },
        [item(), item({ productId: 2 })]
      ),
      unavailableReason: null,
    });
    mocks.sumProductsPrice.mockResolvedValueOnce(2000);
    const caller = appRouter.createCaller(makeContext(30001));
    await expect(
      caller.offers.update({
        id: 5,
        discountType: "amount",
        discountValue: 2500,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates an offer with its products (quantities) scoped to the store", async () => {
    mocks.createOffer.mockResolvedValueOnce(11);
    mocks.setOfferProducts.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext(30001));
    const result = await caller.offers.create({
      name: "باقة الخريف",
      freeDelivery: true,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
    expect(result).toEqual({ id: 11, slug: "باقة-الخريف" });
    expect(mocks.setOfferProducts).toHaveBeenCalledWith({
      storeId: 30001,
      offerId: 11,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
  });

  it("deletes an offer of the caller's store only", async () => {
    mocks.getOfferDetails.mockResolvedValueOnce({
      offer: offer(),
      items: [item(), item({ productId: 2 })],
      pricing: computeOfferPricing(
        { discountType: "percent", discountValue: "10", freeDelivery: false },
        [item(), item({ productId: 2 })]
      ),
      unavailableReason: null,
    });
    mocks.deleteOffer.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext(30001));
    await expect(caller.offers.remove({ id: 5 })).resolves.toEqual({ ok: true });
    expect(mocks.deleteOffer).toHaveBeenCalledWith(30001, 5);
  });
});
