import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  metaCampaignAuditLogs,
  metaCampaigns,
  metaAdSets,
  metaAds,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getMetaAdAccountSecret } from "./profitabilityDb";
import type { CampaignDraft } from "./mediaBuyingAi";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

type ExecutionInput = {
  ownerId: number;
  storeId: number;
  accountId: number;
  draft: CampaignDraft;
  pageId: string;
  imageHash: string;
  destinationUrl: string;
  targetingJson: string;
  optimizationGoal: string;
  billingEvent: string;
  confirmationPhrase: string;
};

type GraphResponse = {
  id?: string;
  error?: { message?: string; code?: number; error_subcode?: number };
};

function centsFromDzd(value: number | null | undefined) {
  return value == null ? null : Math.max(0, Math.round(value * 100));
}
function appsecretProof(token: string) {
  const secret = process.env.META_OAUTH_CLIENT_SECRET;
  return secret
    ? crypto.createHmac("sha256", secret).update(token).digest("hex")
    : undefined;
}
function safeJson(value: unknown) {
  return JSON.stringify(value, (_key, nested) =>
    typeof nested === "string" && nested.length > 500
      ? `${nested.slice(0, 500)}…`
      : nested
  );
}

async function graphPost(
  path: string,
  token: string,
  params: Record<string, string>
): Promise<GraphResponse & { id: string }> {
  const body = new URLSearchParams(params);
  body.set("access_token", token);
  const proof = appsecretProof(token);
  if (proof) body.set("appsecret_proof", proof);
  const response = await fetch(`${GRAPH_URL}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as GraphResponse;
  if (!response.ok || !payload.id)
    throw new Error(
      payload.error?.message || `Meta API error (${response.status}).`
    );
  return payload as GraphResponse & { id: string };
}

async function audit(
  ownerId: number,
  storeId: number,
  accountId: number,
  action: string,
  status: "approved" | "started" | "succeeded" | "failed",
  requestJson?: string,
  responseJson?: string,
  externalCampaignId?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(metaCampaignAuditLogs)
    .values({
      ownerId,
      storeId,
      adAccountId: accountId,
      action,
      status,
      requestJson: requestJson ?? null,
      responseJson: responseJson ?? null,
      externalCampaignId: externalCampaignId ?? null,
    });
}

export async function listMetaCampaignAuditLogs(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: metaCampaignAuditLogs.id,
      action: metaCampaignAuditLogs.action,
      status: metaCampaignAuditLogs.status,
      externalCampaignId: metaCampaignAuditLogs.externalCampaignId,
      createdAt: metaCampaignAuditLogs.createdAt,
    })
    .from(metaCampaignAuditLogs)
    .where(eq(metaCampaignAuditLogs.storeId, storeId))
    .orderBy(desc(metaCampaignAuditLogs.createdAt))
    .limit(20);
}

export async function executeMetaCampaign(input: ExecutionInput) {
  if (input.confirmationPhrase !== "أوافق على إنشاء الحملة")
    throw new Error("يجب كتابة عبارة الموافقة الصحيحة قبل إنشاء الحملة.");
  if (!input.pageId.trim() || !/^\d+$/.test(input.pageId.trim()))
    throw new Error("أدخل Page ID صحيحًا.");
  if (!input.imageHash.trim()) throw new Error("أدخل Image Hash للإعلان.");
  if (!/^https?:\/\//i.test(input.destinationUrl.trim()))
    throw new Error("أدخل رابط وجهة HTTPS صحيحًا.");
  let targeting: unknown;
  try {
    targeting = JSON.parse(input.targetingJson);
  } catch {
    throw new Error("Targeting JSON غير صالح.");
  }
  if (!targeting || typeof targeting !== "object")
    throw new Error("Targeting JSON يجب أن يكون كائنًا.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const account = await getMetaAdAccountSecret(input.storeId, input.accountId);
  const request = {
    accountId: input.accountId,
    externalAccountId: account.externalAccountId,
    draft: input.draft,
    pageId: input.pageId,
    imageHash: input.imageHash,
    destinationUrl: input.destinationUrl,
    targeting,
    optimizationGoal: input.optimizationGoal,
    billingEvent: input.billingEvent,
    status: "PAUSED",
  };
  const requestJson = safeJson(request);
  await audit(
    input.ownerId,
    input.storeId,
    input.accountId,
    "campaign_create_approval",
    "approved",
    requestJson
  );
  await audit(
    input.ownerId,
    input.storeId,
    input.accountId,
    "campaign_create",
    "started",
    requestJson
  );
  let campaignId: string | undefined;
  try {
    const campaign = await graphPost(
      `act_${account.externalAccountId}/campaigns`,
      account.accessToken,
      {
        name: input.draft.name.slice(0, 255),
        objective: input.draft.objective,
        buying_type: input.draft.buyingType || "AUCTION",
        status: "PAUSED",
        special_ad_categories: "[]",
        ...(centsFromDzd(input.draft.dailyBudgetDzd) == null
          ? {}
          : { daily_budget: String(centsFromDzd(input.draft.dailyBudgetDzd)) }),
      }
    );
    campaignId = campaign.id;
    const adSet = await graphPost(
      `act_${account.externalAccountId}/adsets`,
      account.accessToken,
      {
        name:
          input.draft.adSets[0]?.name?.slice(0, 255) ||
          `${input.draft.name} · Ad Set`,
        campaign_id: campaign.id,
        status: "PAUSED",
        optimization_goal: input.optimizationGoal,
        billing_event: input.billingEvent,
        targeting: JSON.stringify(targeting),
        ...(input.draft.budgetMode === "ABO" &&
        centsFromDzd(input.draft.dailyBudgetDzd) != null
          ? { daily_budget: String(centsFromDzd(input.draft.dailyBudgetDzd)) }
          : {}),
      }
    );
    const creativeBody = {
      name:
        input.draft.creatives[0]?.name?.slice(0, 255) ||
        `${input.draft.name} · Creative`,
      object_story_spec: JSON.stringify({
        page_id: input.pageId,
        link_data: {
          image_hash: input.imageHash,
          link: input.destinationUrl,
          message: input.draft.creatives[0]?.primaryText || input.draft.name,
          name: input.draft.creatives[0]?.headline || input.draft.name,
          call_to_action: {
            type: input.draft.creatives[0]?.callToAction || "SHOP_NOW",
            value: { link: input.destinationUrl },
          },
        },
      }),
    };
    const creative = await graphPost(
      `act_${account.externalAccountId}/adcreatives`,
      account.accessToken,
      creativeBody
    );
    const ad = await graphPost(
      `act_${account.externalAccountId}/ads`,
      account.accessToken,
      {
        name:
          input.draft.creatives[0]?.name?.slice(0, 255) ||
          `${input.draft.name} · Ad`,
        adset_id: adSet.id!,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: "PAUSED",
      }
    );
    await db
      .insert(metaCampaigns)
      .values({
        adAccountId: input.accountId,
        externalId: campaign.id!,
        name: input.draft.name.slice(0, 255),
        status: "PAUSED",
        objective: input.draft.objective,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: input.draft.name.slice(0, 255),
          status: "PAUSED",
          objective: input.draft.objective,
        },
      });
    const [campaignRow] = await db
      .select({ id: metaCampaigns.id })
      .from(metaCampaigns)
      .where(
        and(
          eq(metaCampaigns.adAccountId, input.accountId),
          eq(metaCampaigns.externalId, campaign.id!)
        )
      )
      .limit(1);
    if (campaignRow) {
      await db
        .insert(metaAdSets)
        .values({
          adAccountId: input.accountId,
          campaignId: campaignRow.id,
          externalId: adSet.id!,
          name: input.draft.adSets[0]?.name || `${input.draft.name} · Ad Set`,
          status: "PAUSED",
        })
        .onDuplicateKeyUpdate({
          set: { campaignId: campaignRow.id, status: "PAUSED" },
        });
      const [adSetRow] = await db
        .select({ id: metaAdSets.id })
        .from(metaAdSets)
        .where(
          and(
            eq(metaAdSets.adAccountId, input.accountId),
            eq(metaAdSets.externalId, adSet.id!)
          )
        )
        .limit(1);
      await db
        .insert(metaAds)
        .values({
          adAccountId: input.accountId,
          campaignId: campaignRow.id,
          adSetId: adSetRow?.id ?? null,
          externalId: ad.id!,
          name: input.draft.creatives[0]?.name || `${input.draft.name} · Ad`,
          status: "PAUSED",
        })
        .onDuplicateKeyUpdate({
          set: {
            campaignId: campaignRow.id,
            adSetId: adSetRow?.id ?? null,
            status: "PAUSED",
          },
        });
    }
    await audit(
      input.ownerId,
      input.storeId,
      input.accountId,
      "campaign_create",
      "succeeded",
      requestJson,
      safeJson({
        campaignId: campaign.id,
        adSetId: adSet.id,
        creativeId: creative.id,
        adId: ad.id,
      }),
      campaign.id
    );
    return {
      status: "succeeded" as const,
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: creative.id,
      adId: ad.id,
      deliveryStatus: "PAUSED" as const,
    };
  } catch (error) {
    await audit(
      input.ownerId,
      input.storeId,
      input.accountId,
      "campaign_create",
      "failed",
      requestJson,
      safeJson({
        message: error instanceof Error ? error.message : "Unknown Meta error",
        campaignId,
      }),
      campaignId
    );
    throw error;
  }
}
