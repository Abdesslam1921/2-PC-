import { describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "رد آمن" } }],
  })),
}));
vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./db", () => ({
  listPublicStoreProducts: vi.fn(async () => [
    {
      id: 1,
      title: "منتج عام",
      description: "وصف",
      price: "1200",
      compareAtPrice: null,
      currency: "DZD",
      inventory: 4,
      trackInventory: true,
      continueSelling: false,
      collectionName: "عناية",
    },
  ]),
}));
vi.mock("./profitabilityReport", () => ({
  getProfitabilityReport: vi.fn(async () => ({
    totals: { revenue: 5000, trueProfit: 1500 },
    byCampaign: [],
  })),
}));
vi.mock("./negotiatorDb", () => ({
  getNegotiatorSettings: vi.fn(async () => undefined),
  getNegotiatorRulesByProduct: vi.fn(async () => new Map()),
}));
vi.mock("./negotiatorEconomics", () => ({
  getProductNegotiationEconomics: vi.fn(async () => []),
}));

import { askBuyerChatbot, askStoreOwnerChatbot } from "./chatbot";
import { getNegotiatorSettings } from "./negotiatorDb";

describe("unified chatbot contexts", () => {
  it("uses public catalog context for the buyer", async () => {
    await expect(
      askBuyerChatbot(undefined, [{ role: "user", content: "ما السعر؟" }])
    ).resolves.toBe("رد آمن");
    const request = invokeLLM.mock.calls.at(-1)?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0].content).toContain("مساعد التسوق");
    expect(request.messages[0].content).toContain("لا تكشف تكاليف المتجر");
    expect(request.messages[0].content).not.toContain("trueProfit");
    expect(request.messages[1].content).toContain("منتج عام");
  });

  it("uses the negotiator prompt when negotiation is enabled for the store", async () => {
    vi.mocked(getNegotiatorSettings).mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      storeId: 7,
      enabled: true,
      autoNegotiate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      askBuyerChatbot(7, [{ role: "user", content: "غالي شوية" }])
    ).resolves.toBe("رد آمن");
    const request = invokeLLM.mock.calls.at(-1)?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0].content).toContain("تفاوض");
    expect(request.messages[0].content).toContain("الصلاحيات");
  });

  it("uses owner-only profitability context for the store owner", async () => {
    await expect(
      askStoreOwnerChatbot(42, [{ role: "user", content: "حلل الربحية" }])
    ).resolves.toBe("رد آمن");
    const request = invokeLLM.mock.calls.at(-1)?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0].content).toContain("صاحب المتجر");
    expect(request.messages[1].content).toContain("trueProfit");
  });
});
