import { and, eq } from "drizzle-orm";
import {
  metaAdAccounts,
  metaAdInsights,
  metaAdSets,
  metaAds,
  metaCampaigns,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getMetaAdAccountSecret } from "./profitabilityDb";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

type MetaObject = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  campaign_id?: string;
  adset_id?: string;
  account_id?: string;
};
type MetaInsight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  date_start: string;
  date_stop: string;
  account_currency?: string;
  currency?: string;
};

async function fetchMeta(
  path: string,
  token: string,
  params: Record<string, string> = {}
) {
  const url = new URL(`${GRAPH_URL}/${path.replace(/^\//, "")}`);
  Object.entries({ access_token: token, ...params }).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );
  const response = await fetch(url);
  const body = (await response.json()) as {
    data?: MetaObject[] | MetaInsight[];
    paging?: { next?: string };
    error?: { message?: string };
  };
  if (!response.ok || body.error)
    throw new Error(
      body.error?.message || `Meta API error (${response.status}).`
    );
  return body;
}

async function fetchAll<T>(
  path: string,
  token: string,
  params: Record<string, string>
) {
  const rows: T[] = [];
  let nextPath: string | undefined = path;
  let nextParams = params;
  while (nextPath) {
    const body = await fetchMeta(nextPath, token, nextParams);
    rows.push(...((body.data ?? []) as T[]));
    if (!body.paging?.next) break;
    const nextUrl = new URL(body.paging.next);
    nextPath = nextUrl.pathname.replace(`${new URL(GRAPH_URL).pathname}/`, "");
    nextParams = Object.fromEntries(nextUrl.searchParams.entries());
    delete nextParams.access_token;
  }
  return rows;
}

export function toStoreCurrencySpend(
  spendOriginal: number,
  currency: string | null | undefined,
  rate: number
) {
  return (currency ?? "").toUpperCase() === "DZD"
    ? spendOriginal
    : spendOriginal * rate;
}

export async function syncMetaAdAccount(
  storeId: number,
  accountId: number,
  dateStart: string,
  dateStop: string
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const account = await getMetaAdAccountSecret(storeId, accountId);
  const settingsRows = await db
    .select()
    .from((await import("../drizzle/schema")).profitabilitySettings)
    .where(
      eq(
        (await import("../drizzle/schema")).profitabilitySettings.storeId,
        storeId
      )
    )
    .limit(1);
  const rate = Number(settingsRows[0]?.usdToDzdRate ?? 0);
  if (!rate)
    throw new Error("حدد سعر صرف عملة الإعلان إلى دج قبل مزامنة الإعلانات.");
  const campaigns = await fetchAll<MetaObject>(
    `${account.externalAccountId}/campaigns`,
    account.accessToken,
    { fields: "id,name,status,effective_status,objective", limit: "100" }
  );
  const campaignMap = new Map<string, number>();
  for (const campaign of campaigns) {
    await db
      .insert(metaCampaigns)
      .values({
        adAccountId: accountId,
        externalId: campaign.id,
        name: campaign.name || campaign.id,
        status: campaign.effective_status || campaign.status || null,
        objective: campaign.objective || null,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: campaign.name || campaign.id,
          status: campaign.effective_status || campaign.status || null,
          objective: campaign.objective || null,
        },
      });
    const [row] = await db
      .select({ id: metaCampaigns.id })
      .from(metaCampaigns)
      .where(
        and(
          eq(metaCampaigns.adAccountId, accountId),
          eq(metaCampaigns.externalId, campaign.id)
        )
      )
      .limit(1);
    if (row) campaignMap.set(campaign.id, row.id);
  }
  const adSets = await fetchAll<MetaObject>(
    `${account.externalAccountId}/adsets`,
    account.accessToken,
    { fields: "id,name,status,effective_status,campaign_id", limit: "100" }
  );
  const adSetMap = new Map<string, number>();
  for (const adSet of adSets) {
    await db
      .insert(metaAdSets)
      .values({
        adAccountId: accountId,
        campaignId: adSet.campaign_id
          ? (campaignMap.get(adSet.campaign_id) ?? null)
          : null,
        externalId: adSet.id,
        name: adSet.name || adSet.id,
        status: adSet.effective_status || adSet.status || null,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: adSet.name || adSet.id,
          status: adSet.effective_status || adSet.status || null,
          campaignId: adSet.campaign_id
            ? (campaignMap.get(adSet.campaign_id) ?? null)
            : null,
        },
      });
    const [row] = await db
      .select({ id: metaAdSets.id })
      .from(metaAdSets)
      .where(
        and(
          eq(metaAdSets.adAccountId, accountId),
          eq(metaAdSets.externalId, adSet.id)
        )
      )
      .limit(1);
    if (row) adSetMap.set(adSet.id, row.id);
  }
  const ads = await fetchAll<MetaObject>(
    `${account.externalAccountId}/ads`,
    account.accessToken,
    {
      fields: "id,name,status,effective_status,campaign_id,adset_id",
      limit: "100",
    }
  );
  for (const ad of ads)
    await db
      .insert(metaAds)
      .values({
        adAccountId: accountId,
        campaignId: ad.campaign_id
          ? (campaignMap.get(ad.campaign_id) ?? null)
          : null,
        adSetId: ad.adset_id ? (adSetMap.get(ad.adset_id) ?? null) : null,
        externalId: ad.id,
        name: ad.name || ad.id,
        status: ad.effective_status || ad.status || null,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: ad.name || ad.id,
          status: ad.effective_status || ad.status || null,
          campaignId: ad.campaign_id
            ? (campaignMap.get(ad.campaign_id) ?? null)
            : null,
          adSetId: ad.adset_id ? (adSetMap.get(ad.adset_id) ?? null) : null,
        },
      });
  const insights = await fetchAll<MetaInsight>(
    `${account.externalAccountId}/insights`,
    account.accessToken,
    {
      level: "campaign",
      fields:
        "campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop,account_currency",
      time_range: JSON.stringify({ since: dateStart, until: dateStop }),
      limit: "100",
    }
  );
  for (const insight of insights) {
    const spendOriginal = Number(insight.spend ?? 0);
    const currency =
      insight.account_currency || insight.currency || account.currency;
    const spendDzd = toStoreCurrencySpend(spendOriginal, currency, rate);
    const purchases = (insight.actions ?? [])
      .filter(action =>
        ["purchase", "omni_purchase"].includes(action.action_type || "")
      )
      .reduce((sum, action) => sum + Number(action.value || 0), 0);
    await db
      .insert(metaAdInsights)
      .values({
        adAccountId: accountId,
        campaignId: insight.campaign_id
          ? (campaignMap.get(insight.campaign_id) ?? null)
          : null,
        adSetId: null,
        adId: null,
        externalObjectId: insight.campaign_id || account.externalAccountId,
        level: "campaign",
        dateStart: insight.date_start,
        dateStop: insight.date_stop,
        currency,
        spendOriginal: spendOriginal.toFixed(4),
        spendDzd: spendDzd.toFixed(2),
        impressions: Number(insight.impressions || 0),
        clicks: Number(insight.clicks || 0),
        leads: Number(
          (insight.actions ?? [])
            .filter(action =>
              ["lead", "onsite_conversion.lead_grouped"].includes(
                action.action_type || ""
              )
            )
            .reduce((sum, action) => sum + Number(action.value || 0), 0)
        ),
        purchases: Math.round(purchases),
        rawJson: JSON.stringify(insight),
      })
      .onDuplicateKeyUpdate({
        set: {
          spendOriginal: spendOriginal.toFixed(4),
          spendDzd: spendDzd.toFixed(2),
          impressions: Number(insight.impressions || 0),
          clicks: Number(insight.clicks || 0),
          leads: Number((insight.actions ?? []).length),
          purchases: Math.round(purchases),
          rawJson: JSON.stringify(insight),
        },
      });
  }
  await db
    .update(metaAdAccounts)
    .set({ status: "connected", lastSyncedAt: new Date(), lastError: null })
    .where(
      and(eq(metaAdAccounts.id, accountId), eq(metaAdAccounts.storeId, storeId))
    );
  return {
    campaigns: campaigns.length,
    adSets: adSets.length,
    ads: ads.length,
    insights: insights.length,
    dateStart,
    dateStop,
  };
}
