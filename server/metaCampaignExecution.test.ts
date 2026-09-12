import { describe, expect, it } from "vitest";
import { executeMetaCampaign } from "./metaCampaignExecution";

const draft = {
  name: "Test",
  objective: "OUTCOME_SALES",
  buyingType: "AUCTION",
  budgetMode: "CBO" as const,
  dailyBudgetDzd: 1000,
  audience: "DZ",
  adSets: [{ name: "Ad Set", optimizationGoal: "LINK_CLICKS", audience: "DZ" }],
  creatives: [
    {
      name: "Creative",
      format: "SINGLE_IMAGE",
      primaryText: "Text",
      headline: "Headline",
      callToAction: "SHOP_NOW",
      destinationUrl: "https://example.com",
    },
  ],
  rationale: [],
  warnings: [],
  missingInputs: [],
};

describe("Meta campaign execution guardrails", () => {
  it("rejects without the exact explicit confirmation phrase", async () => {
    await expect(
      executeMetaCampaign({
        ownerId: 1,
        accountId: 1,
        draft,
        pageId: "1",
        imageHash: "hash",
        destinationUrl: "https://example.com",
        targetingJson: "{}",
        optimizationGoal: "LINK_CLICKS",
        billingEvent: "IMPRESSIONS",
        confirmationPhrase: "أوافق",
      })
    ).rejects.toThrow("عبارة الموافقة الصحيحة");
  });

  it("rejects malformed Page ID before any Meta request", async () => {
    await expect(
      executeMetaCampaign({
        ownerId: 1,
        accountId: 1,
        draft,
        pageId: "page",
        imageHash: "hash",
        destinationUrl: "https://example.com",
        targetingJson: "{}",
        optimizationGoal: "LINK_CLICKS",
        billingEvent: "IMPRESSIONS",
        confirmationPhrase: "أوافق على إنشاء الحملة",
      })
    ).rejects.toThrow("Page ID");
  });
});
