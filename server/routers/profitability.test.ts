import { describe, expect, it } from "vitest";
import {
  normalizeMetaAdAccountId,
  profitabilityCampaignLinksInput,
} from "./profitability";
import { PROFITABILITY_FINAL_STATUSES } from "../profitabilityReport";

describe("profitability contracts", () => {
  it("normalizes Meta account ids to act_ format", () => {
    expect(normalizeMetaAdAccountId("123456789")).toBe("act_123456789");
    expect(normalizeMetaAdAccountId("ACT_123456789")).toBe("act_123456789");
  });
  it("rejects non-numeric account ids", () => {
    expect(() => normalizeMetaAdAccountId("business-main")).toThrow(
      "معرف حساب Meta غير صالح"
    );
  });
  it("defines terminal COD states without treating them all as realized revenue", () => {
    expect(PROFITABILITY_FINAL_STATUSES).toContain("delivered");
    expect(PROFITABILITY_FINAL_STATUSES).toContain("returned");
    expect(PROFITABILITY_FINAL_STATUSES).toContain("cancelled");
  });
  it("accepts campaign links with a nullable product id", () => {
    expect(
      profitabilityCampaignLinksInput.parse({
        links: [
          { campaignId: "23847564390751", productId: 12 },
          { campaignId: "23847564390752", productId: null },
        ],
      }).links
    ).toHaveLength(2);
  });
  it("trims campaign ids before validation", () => {
    const parsed = profitabilityCampaignLinksInput.parse({
      links: [{ campaignId: "  23847564390751  ", productId: null }],
    });
    expect(parsed.links[0].campaignId).toBe("23847564390751");
  });
  it("rejects an invalid product id in a campaign link", () => {
    expect(() =>
      profitabilityCampaignLinksInput.parse({
        links: [{ campaignId: "23847564390751", productId: 0 }],
      })
    ).toThrow();
    expect(() =>
      profitabilityCampaignLinksInput.parse({
        links: [{ campaignId: "23847564390751", productId: -3 }],
      })
    ).toThrow();
  });
});
