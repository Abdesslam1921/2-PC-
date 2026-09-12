import { invokeLLM } from "./_core/llm";
import { getProfitabilityReport } from "./profitabilityReport";

export async function analyzeProfitabilityCampaigns(storeId: number) {
  const report = await getProfitabilityReport(storeId);
  if (!report.byCampaign.length)
    return {
      available: false,
      reason: "لا توجد حملات مرتبطة بطلبات حقيقية لتحليلها بعد.",
      insights: null,
    } as const;
  const compact = report.byCampaign.map(campaign => ({
    campaign: campaign.campaignId,
    orders: campaign.orders,
    revenueDzd: campaign.revenue,
    adSpendDzd: campaign.adSpend,
    trueProfitDzd: campaign.trueProfit,
    roas: campaign.roas,
  }));
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "أنت محلل ربحية تجارة إلكترونية. حلل الأرقام المقدمة فقط. لا تخترع أسبابًا أو أرقامًا غير موجودة. ميّز بين دليل مباشر واستنتاج يحتاج تحققًا. أخرج JSON فقط بالعربية.",
      },
      {
        role: "user",
        content: JSON.stringify({ totals: report.totals, campaigns: compact }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "profitability_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            winners: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  campaign: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["campaign", "reason"],
                additionalProperties: false,
              },
            },
            losers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  campaign: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["campaign", "reason"],
                additionalProperties: false,
              },
            },
            actions: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "winners", "losers", "actions"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string")
    return {
      available: false,
      reason: "لم يُرجع نموذج AI نتيجة قابلة للعرض.",
      insights: null,
    } as const;
  try {
    const parsed = JSON.parse(content) as {
      summary: string;
      winners: Array<{ campaign: string; reason: string }>;
      losers: Array<{ campaign: string; reason: string }>;
      actions: string[];
    };
    return {
      available: true,
      dataFreshness: "مبني على آخر مزامنة وطلبات حقيقية",
      insights: parsed,
    } as const;
  } catch {
    return {
      available: false,
      reason: "تعذر قراءة نتيجة تحليل AI. أعد المحاولة لاحقًا.",
      insights: null,
    } as const;
  }
}
