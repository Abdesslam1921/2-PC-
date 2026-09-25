import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createCodOrder: vi.fn(),
  getPublicStoreProduct: vi.fn(),
  listStoreOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock("../db", () => ({
  createCodOrder: mocks.createCodOrder,
  getPublicStoreProduct: mocks.getPublicStoreProduct,
  listStoreOrders: mocks.listStoreOrders,
  updateStoreOrderStatus: mocks.updateOrderStatus,
}));

import { appRouter } from "../routers";

function context(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "store-owner",
      email: "owner@example.com",
      name: "Store Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    store: {
      id: 7,
      ownerId: 42,
      name: "متجر",
      slug: "store",
      language: "dz-ar",
      templateId: null,
      aiStyleConfig: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    storeId: 7,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("orders.createCod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createCodOrder.mockResolvedValue({
      id: 12,
      orderNumber: "ABD-000012",
      total: "8400.00",
      paymentMethod: "cod",
    });
    mocks.listStoreOrders.mockResolvedValue([
      { id: 12, orderNumber: "ABD-000012" },
    ]);
    mocks.updateOrderStatus.mockResolvedValue({
      id: 12,
      fulfillmentStatus: "shipped",
    });
  });

  it("creates a cash-on-delivery order from validated and merged cart lines", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.orders.createCod({
      customerName: "محمد أمين",
      customerPhone: "0550000000",
      wilaya: "الجزائر",
      wilayaCode: "05",
      address: "الحي الجديد، شارع 1",
      notes: "اتصل قبل التوصيل",
      lines: [
        { productId: 7, variantId: 11, quantity: 1 },
        { productId: 7, variantId: 11, quantity: 2 },
      ],
    });

    expect(mocks.createCodOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "محمد أمين",
        wilaya: "الجزائر",
        wilayaCode: "05",
      }),
      [{ productId: 7, variantId: 11, quantity: 3 }],
      []
    );
    expect(result).toMatchObject({
      orderNumber: "ABD-000012",
      paymentMethod: "cod",
    });
  });

  it("rejects a phone number that is not a 10-digit Algerian mobile number", async () => {
    const caller = appRouter.createCaller(context());
    await expect(
      caller.orders.createCod({
        customerName: "محمد أمين",
        customerPhone: "021234567",
        wilaya: "الجزائر",
        address: "الحي الجديد، شارع 1",
        lines: [{ productId: 7, quantity: 1 }],
      })
    ).rejects.toThrow("رقم الهاتف يجب أن يبدأ");
    expect(mocks.createCodOrder).not.toHaveBeenCalled();
  });

  it("returns orders only for the authenticated store owner", async () => {
    const caller = appRouter.createCaller(context());
    const orders = await caller.orders.list();

    expect(mocks.listStoreOrders).toHaveBeenCalledWith(7);
    expect(orders).toEqual([{ id: 12, orderNumber: "ABD-000012" }]);
  });

  it("updates a fulfillment status only through the authenticated store owner", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.orders.updateStatus({
      orderId: 12,
      fulfillmentStatus: "shipped",
    });

    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(7, 12, "shipped");
    expect(result).toMatchObject({ id: 12, fulfillmentStatus: "shipped" });
  });
});
