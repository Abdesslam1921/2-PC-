import { and, eq, inArray } from "drizzle-orm";
import { negotiatorProductRules, negotiatorSettings } from "../drizzle/schema";
import { getDb } from "./db";

export type NegotiatorSettingsInput = {
  enabled: boolean;
  autoNegotiate: boolean;
};

export type NegotiatorProductRuleInput = {
  productId: number;
  enabled: boolean;
  maxDiscountAmount: string;
  maxDiscountPercent: number;
  minPrice: string | null;
  minProfitMarginPercent: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinQuantity: number;
  freeDeliveryMaxFee: string;
  customRules?: string | null;
};

const clampInt = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
const clampMoney = (value: string | null | undefined) => {
  const parsed = Math.round((Number(value ?? 0) || 0) * 100) / 100;
  return Math.max(0, parsed).toFixed(2);
};
const cleanRules = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
};

export async function getNegotiatorSettings(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(negotiatorSettings)
    .where(eq(negotiatorSettings.storeId, storeId))
    .limit(1);
  return row;
}

export async function saveNegotiatorSettings(
  ownerId: number,
  storeId: number,
  input: NegotiatorSettingsInput
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    autoNegotiate: input.autoNegotiate,
  };
  await db
    .insert(negotiatorSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        autoNegotiate: values.autoNegotiate,
      },
    });
  return getNegotiatorSettings(storeId);
}

export async function listNegotiatorProductRules(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(negotiatorProductRules)
    .where(eq(negotiatorProductRules.storeId, storeId));
}

export async function replaceNegotiatorProductRules(
  ownerId: number,
  storeId: number,
  rules: NegotiatorProductRuleInput[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .delete(negotiatorProductRules)
    .where(eq(negotiatorProductRules.storeId, storeId));
  if (rules.length) {
    await db.insert(negotiatorProductRules).values(
      rules.map(rule => ({
        ownerId,
        storeId,
        productId: rule.productId,
        enabled: rule.enabled,
        maxDiscountAmount: clampMoney(rule.maxDiscountAmount),
        maxDiscountPercent: clampInt(rule.maxDiscountPercent, 0, 100),
        minPrice: rule.minPrice?.trim() ? clampMoney(rule.minPrice) : null,
        minProfitMarginPercent: clampInt(rule.minProfitMarginPercent, 0, 100),
        freeDeliveryEnabled: rule.freeDeliveryEnabled,
        freeDeliveryMinQuantity: clampInt(rule.freeDeliveryMinQuantity, 1, 100),
        freeDeliveryMaxFee: clampMoney(rule.freeDeliveryMaxFee),
        customRules: cleanRules(rule.customRules),
      }))
    );
  }
  return listNegotiatorProductRules(storeId);
}

export async function getNegotiatorRulesByProduct(
  storeId: number,
  productIds: number[]
) {
  const db = await getDb();
  if (!db) return new Map<number, typeof negotiatorProductRules.$inferSelect>();
  if (!productIds.length) return new Map();
  const rows = await db
    .select()
    .from(negotiatorProductRules)
    .where(
      and(
        eq(negotiatorProductRules.storeId, storeId),
        inArray(negotiatorProductRules.productId, productIds)
      )
    );
  return new Map(rows.map(row => [row.productId, row]));
}
