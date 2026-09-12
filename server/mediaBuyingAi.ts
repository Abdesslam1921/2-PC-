import { invokeLLM } from "./_core/llm";
import { getProfitabilityReport } from "./profitabilityReport";

export type MediaBuyingMessage = {
  role: "user" | "assistant";
  content: string;
};
export const META_KNOWLEDGE_CONTEXT =
  "آخر مراجعة موثقة: 2026-08-27. تعتمد الإرشادات على Meta Marketing API وAuthorization الرسميين: https://developers.facebook.com/documentation/ads-commerce/marketing-api وhttps://developers.facebook.com/docs/marketing-api/overview/authorization/. تستخدم الحملات أهداف ODAX الحديثة: OUTCOME_AWARENESS وOUTCOME_TRAFFIC وOUTCOME_ENGAGEMENT وOUTCOME_LEADS وOUTCOME_SALES وOUTCOME_APP_PROMOTION. تحقق من وثائق Meta قبل أي تغيّر زمني جديد.";
export const MEDIA_BUYING_SYSTEM_PROMPT =
  "أنت مستشار Media Buying محترف ومتخصص في Meta Ads للتجارة الإلكترونية والدفع عند الاستلام. أجب بالعربية الواضحة وبأسلوب عملي. استخدم فقط أرقام الربحية المعطاة، ولا تخترع بيانات أو نتائج أو تحديثات. فرّق دائمًا بين الاقتراح والتنفيذ، ولا تعد بإنشاء أو نشر حملة خارج بوابة الموافقة؛ أنشئ مسودة قابلة للمراجعة فقط ولا تنفذ أي إجراء تغييري بنفسك. عند تحليل Meta استخدم المصطلحات الرسمية Reach وClicks (all) وLink clicks وSpend وResults وCost per result، وقل N/A عند غياب البيانات. لا توصي بإيقاف حملة اعتمادًا على متوسط CPA وحده؛ صغ التغيير كفرضية قابلة للاختبار مع دليل.";

export async function askMediaBuyingAi(
  storeId: number,
  messages: MediaBuyingMessage[]
) {
  const report = await getProfitabilityReport(storeId);
  const context = {
    currency: "DZD",
    profitability: report.totals,
    campaigns: report.byCampaign.slice(0, 30),
    capability: {
      read: [
        "ads_get_ad_accounts",
        "ads_get_ad_entities",
        "ads_insights_performance_trend",
      ],
      write: [
        "ads_create_campaign",
        "ads_create_ad_set",
        "ads_create_creative",
        "ads_create_ad",
        "ads_update_entity",
        "ads_activate_entity",
      ],
      guardrails: [
        "client_conversation_id مطلوب",
        "موافقة صريحة قبل الكتابة",
        "لا نشر تلقائي",
      ],
    },
  };
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `${MEDIA_BUYING_SYSTEM_PROMPT} ${META_KNOWLEDGE_CONTEXT}`,
      },
      {
        role: "user",
        content: `سياق المتجر الحالي:\n${JSON.stringify(context)}\n\nالمحادثة:\n${messages.map(message => `${message.role}: ${message.content}`).join("\n")}`,
      },
    ],
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" && content.trim()
    ? content
    : "لم يُرجع المساعد نتيجة قابلة للعرض. أعد المحاولة.";
}

export type CampaignDraft = {
  name: string;
  objective: string;
  buyingType: string;
  budgetMode: string;
  dailyBudgetDzd: number | null;
  audience: string;
  adSets: Array<{ name: string; optimizationGoal: string; audience: string }>;
  creatives: Array<{
    name: string;
    format: string;
    primaryText: string;
    headline: string;
    callToAction: string;
    destinationUrl: string | null;
  }>;
  rationale: string[];
  warnings: string[];
  missingInputs: string[];
};

export async function prepareCampaignDraft(
  storeId: number,
  messages: MediaBuyingMessage[]
): Promise<CampaignDraft> {
  const report = await getProfitabilityReport(storeId);
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `${MEDIA_BUYING_SYSTEM_PROMPT} ${META_KNOWLEDGE_CONTEXT} أعد JSON فقط بهذه المفاتيح: name, objective, buyingType, budgetMode, dailyBudgetDzd, audience, adSets, creatives, rationale, warnings, missingInputs. استخدم null عندما لا توجد قيمة مؤكدة، ولا تخترع ميزانية أو أرقام ربح.`,
      },
      {
        role: "user",
        content: `بيانات الربحية الحقيقية الحالية بالدينار الجزائري:\n${JSON.stringify({ totals: report.totals, campaigns: report.byCampaign.slice(0, 30) })}\n\nطلب المعلن:\n${messages.map(message => `${message.role}: ${message.content}`).join("\\n")}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error("تعذر إنشاء معاينة منظمة للحملة.");
  return JSON.parse(content) as CampaignDraft;
}
