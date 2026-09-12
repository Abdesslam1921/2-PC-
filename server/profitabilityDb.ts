import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  metaAdAccounts,
  metaCampaigns,
  profitabilityCampaignLinks,
  profitabilitySettings,
  storeProducts,
} from "../drizzle/schema";
import { decryptSecret, encryptSecret } from "./secureSecrets";

export async function listStoreCampaigns(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const accounts = await db
    .select({ id: metaAdAccounts.id })
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.storeId, storeId));
  const accountIds = accounts.map(account => account.id);
  if (!accountIds.length) return [];
  return db
    .select({ externalId: metaCampaigns.externalId, name: metaCampaigns.name })
    .from(metaCampaigns)
    .where(inArray(metaCampaigns.adAccountId, accountIds))
    .orderBy(asc(metaCampaigns.name));
}

export async function listCampaignProductLinks(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const campaigns = await listStoreCampaigns(storeId);
  if (!campaigns.length) return [];
  const links = await db
    .select()
    .from(profitabilityCampaignLinks)
    .where(eq(profitabilityCampaignLinks.storeId, storeId));
  const productByCampaign = new Map(
    links.map(link => [link.campaignExternalId, link.productId])
  );
  return campaigns.map(campaign => ({
    campaignId: campaign.externalId,
    campaignName: campaign.name,
    productId: productByCampaign.get(campaign.externalId) ?? null,
  }));
}

export async function saveCampaignProductLinks(
  ownerId: number,
  storeId: number,
  links: Array<{ campaignId: string; productId: number | null }>
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const campaigns = await listStoreCampaigns(storeId);
  const allowedCampaigns = new Set(
    campaigns.map(campaign => campaign.externalId)
  );
  for (const link of links) {
    if (!allowedCampaigns.has(link.campaignId))
      throw new Error(
        "إحدى الحملات غير موجودة أو لا تنتمي إلى متجرك. أعد المزامنة أولًا."
      );
  }
  const productIds = Array.from(
    new Set(
      links
        .map(link => link.productId)
        .filter((productId): productId is number => Boolean(productId))
    )
  );
  if (productIds.length) {
    const found = await db
      .select({ id: storeProducts.id })
      .from(storeProducts)
      .where(
        and(
          inArray(storeProducts.id, productIds),
          eq(storeProducts.storeId, storeId)
        )
      );
    if (found.length !== productIds.length)
      throw new Error("أحد المنتجات غير موجود أو لا ينتمي إلى متجرك.");
  }
  return db
    .transaction(async tx => {
      await tx
        .delete(profitabilityCampaignLinks)
        .where(eq(profitabilityCampaignLinks.storeId, storeId));
      const values = links
        .filter(link => link.productId)
        .map(link => ({
          ownerId,
          storeId,
          campaignExternalId: link.campaignId,
          productId: link.productId as number,
        }));
      if (values.length)
        await tx.insert(profitabilityCampaignLinks).values(values);
    })
    .then(() => listCampaignProductLinks(storeId));
}

export async function getProfitabilitySettings(storeId: number) {
  const db = await getDb();
  if (!db)
    return {
      baseCurrency: "DZD",
      usdToDzdRate: "0.00",
      includePendingOrders: false,
    };
  const [settings] = await db
    .select()
    .from(profitabilitySettings)
    .where(eq(profitabilitySettings.storeId, storeId))
    .limit(1);
  return settings
    ? {
        baseCurrency: settings.baseCurrency,
        usdToDzdRate: settings.usdToDzdRate,
        includePendingOrders: settings.includePendingOrders,
      }
    : {
        baseCurrency: "DZD",
        usdToDzdRate: "0.00",
        includePendingOrders: false,
      };
}

export async function saveProfitabilitySettings(
  ownerId: number,
  storeId: number,
  input: { usdToDzdRate: string; includePendingOrders: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .insert(profitabilitySettings)
    .values({
      ownerId,
      storeId,
      baseCurrency: "DZD",
      usdToDzdRate: input.usdToDzdRate,
      includePendingOrders: input.includePendingOrders,
    })
    .onDuplicateKeyUpdate({
      set: {
        usdToDzdRate: input.usdToDzdRate,
        includePendingOrders: input.includePendingOrders,
      },
    });
  return getProfitabilitySettings(storeId);
}

function publicAccount(account: typeof metaAdAccounts.$inferSelect) {
  return {
    id: account.id,
    externalAccountId: account.externalAccountId,
    name: account.name,
    currency: account.currency,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
    lastError: account.lastError,
    hasToken: Boolean(account.accessTokenEncrypted),
  };
}

export async function listMetaAdAccounts(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.storeId, storeId))
    .orderBy(asc(metaAdAccounts.createdAt));
  return rows.map(publicAccount);
}

export async function saveMetaAdAccount(
  ownerId: number,
  storeId: number,
  input: {
    id?: number;
    externalAccountId: string;
    name: string;
    currency: string;
    accessToken?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  let target = input.id
    ? (
        await db
          .select()
          .from(metaAdAccounts)
          .where(
            and(
              eq(metaAdAccounts.id, input.id),
              eq(metaAdAccounts.storeId, storeId)
            )
          )
          .limit(1)
      )[0]
    : undefined;
  if (!target) {
    [target] = await db
      .select()
      .from(metaAdAccounts)
      .where(
        and(
          eq(metaAdAccounts.storeId, storeId),
          eq(metaAdAccounts.externalAccountId, input.externalAccountId.trim())
        )
      )
      .limit(1);
  }
  const tokenEncrypted = input.accessToken?.trim()
    ? encryptSecret(input.accessToken.trim())
    : target?.accessTokenEncrypted;
  if (!tokenEncrypted) throw new Error("أدخل Access Token للحساب الإعلاني.");
  const values = {
    ownerId,
    storeId,
    externalAccountId: input.externalAccountId.trim(),
    name: input.name.trim(),
    currency: input.currency.trim().toUpperCase(),
    accessTokenEncrypted: tokenEncrypted,
    status: "connected" as const,
    lastError: null,
  };
  if (target)
    await db
      .update(metaAdAccounts)
      .set(values)
      .where(eq(metaAdAccounts.id, target.id));
  else await db.insert(metaAdAccounts).values(values);
  const rows = await db
    .select()
    .from(metaAdAccounts)
    .where(
      and(
        eq(metaAdAccounts.storeId, storeId),
        eq(metaAdAccounts.externalAccountId, values.externalAccountId)
      )
    )
    .limit(1);
  return rows[0] ? publicAccount(rows[0]) : undefined;
}

export async function removeMetaAdAccount(storeId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .delete(metaAdAccounts)
    .where(and(eq(metaAdAccounts.id, id), eq(metaAdAccounts.storeId, storeId)));
  return { success: true } as const;
}

export async function setMetaAdAccountSchedule(
  storeId: number,
  id: number,
  scheduleCronTaskUid: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .update(metaAdAccounts)
    .set({ scheduleCronTaskUid })
    .where(and(eq(metaAdAccounts.id, id), eq(metaAdAccounts.storeId, storeId)));
  return { success: true } as const;
}

export async function getMetaAdAccountSecret(storeId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [account] = await db
    .select()
    .from(metaAdAccounts)
    .where(and(eq(metaAdAccounts.id, id), eq(metaAdAccounts.storeId, storeId)))
    .limit(1);
  if (!account) throw new Error("حساب Meta غير موجود.");
  return {
    ...account,
    accessToken: decryptSecret(account.accessTokenEncrypted),
  };
}
