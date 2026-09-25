import { describe, expect, it, vi } from "vitest";
import { deliveryRouter } from "./delivery";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  carriers: vi.fn(),
  connect: vi.fn(),
  product: vi.fn(),
}));
vi.mock("../db", () => ({
  getDeliverySettings: mocks.get,
  saveDeliverySettings: mocks.save,
  listCarrierConnections: mocks.carriers,
  saveCarrierConnection: mocks.connect,
  getPublicStoreProduct: mocks.product,
}));

const ctx = {
  user: { id: 41 },
  store: {
    id: 7,
    ownerId: 41,
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
} as never;

describe("delivery router", () => {
  it("returns owner-scoped settings and saves valid office/home rates", async () => {
    mocks.get.mockResolvedValue({
      settings: {
        fixedOfficeEnabled: false,
        fixedOfficeFee: null,
        fixedHomeEnabled: false,
        fixedHomeFee: null,
      },
      wilayaRates: [],
    });
    mocks.save.mockResolvedValue({ settings: {}, wilayaRates: [] });
    const caller = deliveryRouter.createCaller(ctx);
    await expect(caller.getSettings()).resolves.toEqual(
      expect.objectContaining({ wilayaRates: [] })
    );
    await caller.saveSettings({
      fixedOfficeEnabled: true,
      fixedOfficeFee: "600",
      fixedHomeEnabled: false,
      fixedHomeFee: null,
      wilayaRates: [
        {
          wilayaCode: "16",
          wilayaName: "الجزائر",
          officeEnabled: true,
          officeFee: "400",
          homeEnabled: true,
          homeFee: "600",
        },
      ],
    });
    expect(mocks.get).toHaveBeenCalledWith(7);
    expect(mocks.save).toHaveBeenCalledWith(
      41,
      7,
      expect.objectContaining({
        fixedOfficeFee: "600",
        wilayaRates: [
          expect.objectContaining({ wilayaName: "الجزائر", homeFee: "600" }),
        ],
      })
    );
  });

  it("lists linked carriers and saves the selected pricing mode", async () => {
    mocks.carriers.mockResolvedValue([
      { provider: "yalidine", status: "connected" },
    ]);
    mocks.connect.mockResolvedValue({ success: true });
    const caller = deliveryRouter.createCaller(ctx);
    await expect(caller.carriers()).resolves.toEqual([
      { provider: "yalidine", status: "connected" },
    ]);
    await caller.connectCarrier({
      provider: "yalidine",
      accountName: "الحساب الرئيسي",
      userGuid: "merchant-guid",
      apiToken: "token-123456",
      pricingMode: "carrier",
    });
    expect(mocks.carriers).toHaveBeenCalledWith(7);
    expect(mocks.connect).toHaveBeenCalledWith(
      41,
      7,
      expect.objectContaining({ provider: "yalidine", pricingMode: "carrier" })
    );
    await expect(
      caller.connectCarrier({
        provider: "ecotrack",
        accountName: "",
        userGuid: "",
        apiToken: "token-123456",
        pricingMode: "manual",
      })
    ).rejects.toThrow("اسم الحساب إجباري");
    await caller.connectCarrier({
      provider: "ecotrack",
      accountName: "HHD EXPRESS",
      userGuid: "",
      apiBaseUrl: "https://hhdexpress.ecotrack.dz",
      apiToken: "token-123456",
      pricingMode: "carrier",
    });
    expect(mocks.connect).toHaveBeenLastCalledWith(
      41,
      7,
      expect.objectContaining({
        provider: "ecotrack",
        accountName: "HHD EXPRESS",
        apiBaseUrl: "https://hhdexpress.ecotrack.dz",
      })
    );
  });

  it("returns the wilaya fee by code and falls back from a zero placeholder to fixed pricing", async () => {
    mocks.product.mockResolvedValue({ ownerId: 41, storeId: 7 });
    mocks.get.mockResolvedValue({
      settings: {
        fixedOfficeEnabled: false,
        fixedOfficeFee: null,
        fixedHomeEnabled: true,
        fixedHomeFee: "700.00",
      },
      wilayaRates: [
        {
          wilayaCode: "05",
          wilayaName: "باتنة",
          officeEnabled: true,
          officeFee: "0.00",
          homeEnabled: true,
          homeFee: "0.00",
        },
      ],
    });
    const caller = deliveryRouter.createCaller(ctx);
    await expect(
      caller.quoteForProduct({
        productId: 9,
        wilaya: "باتنة",
        wilayaCode: "05",
        deliveryMethod: "home",
      })
    ).resolves.toEqual({ deliveryFee: "700.00", configured: true });
  });

  it("waives the fee when the product itself has free delivery", async () => {
    mocks.product.mockResolvedValue({
      ownerId: 41,
      storeId: 7,
      freeDelivery: true,
    });
    mocks.get.mockResolvedValue({
      settings: {
        fixedOfficeEnabled: false,
        fixedOfficeFee: null,
        fixedHomeEnabled: true,
        fixedHomeFee: "700.00",
      },
      wilayaRates: [],
    });
    const caller = deliveryRouter.createCaller(ctx);
    await expect(
      caller.quoteForProduct({
        productId: 9,
        wilaya: "باتنة",
        wilayaCode: "05",
        deliveryMethod: "home",
      })
    ).resolves.toEqual({ deliveryFee: "0.00", configured: true, free: true });
  });

  it("rejects a wilaya with no delivery mode", async () => {
    const caller = deliveryRouter.createCaller(ctx);
    await expect(
      caller.saveSettings({
        fixedOfficeEnabled: false,
        fixedOfficeFee: null,
        fixedHomeEnabled: false,
        fixedHomeFee: null,
        wilayaRates: [
          {
            wilayaCode: "16",
            wilayaName: "الجزائر",
            officeEnabled: false,
            officeFee: null,
            homeEnabled: false,
            homeFee: null,
          },
        ],
      })
    ).rejects.toThrow("فعّل التوصيل للمكتب أو للمنزل على الأقل");
  });
});
