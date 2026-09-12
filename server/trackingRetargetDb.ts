import { and, count, desc, eq, gt, isNull, lt } from "drizzle-orm";
import {
  storeOrders,
  storeProducts,
  stores,
  trackingRetargetOrderStates,
  trackingRetargetSends,
  trackingRetargetSettings,
  type TrackingRetargetOrderState,
  type TrackingRetargetSettings,
} from "../drizzle/schema";
import { getDb } from "./db";
import { decryptSecret, encryptSecret } from "./secureSecrets";

export type SupportNumber = { label: string; number: string; active: boolean };

export const TRACKING_RETARGET_DEFAULTS = {
  trackTitle: "تتبع طلبك عبر واتساب",
  trackHint: "أرسل رقم طلبك وسنرد عليك مباشرة بمتابعة طلبك لحظة بلحظة.",
  trackCta: "تتبع طلبك الآن",
  trackMessage: "مرحبًا، أريد تتبع طلبية رقم {orderNumber}",
  statusMessage:
    "مرحبًا {customerName} 👋\nطلبك رقم {orderNumber} أصبح بحالة:\n{status}\n\nشكرًا لثقتك بنا 💚",
  retargetMessage:
    "أهلًا {customerName} 🌟\nوصل طلبك {orderNumber} ونتمنى إنه عجبك 😍\nكعربون شكر منا إليك تخفيض {discount}% على:\n{productTitle}\n\n{productLink}\n\nالعرض لفترة محدودة، استفيد قبل ما يفوتك 💚",
} as const;

export const DELIVERED_RAW_STATUSES = new Set([
  "livred",
  "encassed",
  "payed",
  "delivered",
]);

export type TrackingRetargetSettingsView = {
  id: number;
  enabled: boolean;
  whatsappPhoneId: string;
  whatsappConfigured: boolean;
  supportNumbers: SupportNumber[];
  trackTitle: string;
  trackHint: string;
  trackCta: string;
  trackMessage: string;
  statusEnabled: boolean;
  statusMessage: string;
  retargetEnabled: boolean;
  retargetTargetType: "product" | "landing";
  retargetProductId: number | null;
  retargetLandingPageId: number | null;
  retargetLandingUrl: string;
  retargetDiscountPercent: number;
  retargetDelayDays: number;
  retargetMessage: string;
};

function digitsOnly(value: string | null | undefined, max = 20) {
  return (value ?? "").replace(/\D/g, "").slice(0, max);
}

export function cleanSupportNumbers(
  items: Array<{ label?: string; number?: string | null; active?: boolean }>
): SupportNumber[] {
  const cleaned = (Array.isArray(items) ? items : [])
    .map(item => ({
      label: (item.label?.trim() || "رقم الدعم").slice(0, 160),
      number: digitsOnly(item.number),
      active: Boolean(item.active),
    }))
    .filter(item => item.number.length >= 9)
    .slice(0, 12);
  if (cleaned.some(item => item.active)) {
    let chosen = false;
    return cleaned.map(item => {
      if (item.active && !chosen) {
        chosen = true;
        return item;
      }
      return { ...item, active: false };
    });
  }
  if (cleaned.length) cleaned[0] = { ...cleaned[0], active: true };
  return cleaned;
}

function serializeNumbers(numbers: SupportNumber[]) {
  return JSON.stringify(numbers);
}

function parseNumbers(value: string | null | undefined): SupportNumber[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<{
      label?: string;
      number?: string;
      active?: boolean;
    }>;
    return cleanSupportNumbers(parsed);
  } catch {
    return [];
  }
}

function toSettingsView(
  row: TrackingRetargetSettings
): TrackingRetargetSettingsView {
  return {
    id: row.id,
    enabled: Boolean(row.enabled),
    whatsappPhoneId: row.whatsappPhoneId ?? "",
    whatsappConfigured: Boolean(
      row.whatsappPhoneId && row.whatsappTokenEncrypted
    ),
    supportNumbers: parseNumbers(row.supportNumbersJson),
    trackTitle: row.trackTitle || TRACKING_RETARGET_DEFAULTS.trackTitle,
    trackHint: row.trackHint || TRACKING_RETARGET_DEFAULTS.trackHint,
    trackCta: row.trackCta || TRACKING_RETARGET_DEFAULTS.trackCta,
    trackMessage: row.trackMessage || TRACKING_RETARGET_DEFAULTS.trackMessage,
    statusEnabled: Boolean(row.statusEnabled),
    statusMessage:
      row.statusMessage || TRACKING_RETARGET_DEFAULTS.statusMessage,
    retargetEnabled: Boolean(row.retargetEnabled),
    retargetTargetType: row.retargetTargetType ?? "product",
    retargetProductId: row.retargetProductId ?? null,
    retargetLandingPageId: row.retargetLandingPageId ?? null,
    retargetLandingUrl: row.retargetLandingUrl ?? "",
    retargetDiscountPercent: row.retargetDiscountPercent ?? 10,
    retargetDelayDays: row.retargetDelayDays ?? 3,
    retargetMessage:
      row.retargetMessage || TRACKING_RETARGET_DEFAULTS.retargetMessage,
  };
}

export async function getTrackingRetargetSettingsRow(
  storeId: number
): Promise<TrackingRetargetSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(trackingRetargetSettings)
    .where(eq(trackingRetargetSettings.storeId, storeId))
    .limit(1);
  return row ?? null;
}

export async function getTrackingRetargetSettings(
  storeId: number
): Promise<TrackingRetargetSettingsView | null> {
  const row = await getTrackingRetargetSettingsRow(storeId);
  return row ? toSettingsView(row) : null;
}

export type TrackingRetargetSaveInput = {
  enabled: boolean;
  whatsappPhoneId: string;
  whatsappToken?: string;
  clearWhatsappToken?: boolean;
  supportNumbers: SupportNumber[];
  trackTitle: string;
  trackHint: string;
  trackCta: string;
  trackMessage: string;
  statusEnabled: boolean;
  statusMessage: string;
  retargetEnabled: boolean;
  retargetTargetType: "product" | "landing";
  retargetProductId?: number | null;
  retargetLandingPageId?: number | null;
  retargetLandingUrl: string;
  retargetDiscountPercent: number;
  retargetDelayDays: number;
  retargetMessage: string;
};

export async function saveTrackingRetargetSettings(
  ownerId: number,
  storeId: number,
  input: TrackingRetargetSaveInput
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const existing = await getTrackingRetargetSettingsRow(storeId);
  const supportNumbers = cleanSupportNumbers(input.supportNumbers);
  const values = {
    ownerId,
    storeId,
    enabled: Boolean(input.enabled),
    whatsappPhoneId: input.whatsappPhoneId.trim().slice(0, 80) || null,
    whatsappTokenEncrypted: input.clearWhatsappToken
      ? null
      : input.whatsappToken?.trim()
        ? encryptSecret(input.whatsappToken.trim())
        : (existing?.whatsappTokenEncrypted ?? null),
    supportNumbersJson: serializeNumbers(supportNumbers),
    trackTitle:
      input.trackTitle.trim().slice(0, 180) ||
      TRACKING_RETARGET_DEFAULTS.trackTitle,
    trackHint:
      input.trackHint.trim().slice(0, 500) ||
      TRACKING_RETARGET_DEFAULTS.trackHint,
    trackCta:
      input.trackCta.trim().slice(0, 180) ||
      TRACKING_RETARGET_DEFAULTS.trackCta,
    trackMessage:
      input.trackMessage.trim().slice(0, 500) ||
      TRACKING_RETARGET_DEFAULTS.trackMessage,
    statusEnabled: Boolean(input.statusEnabled),
    statusMessage:
      input.statusMessage.trim().slice(0, 2000) ||
      TRACKING_RETARGET_DEFAULTS.statusMessage,
    retargetEnabled: Boolean(input.retargetEnabled),
    retargetTargetType: input.retargetTargetType,
    retargetProductId: input.retargetProductId ?? null,
    retargetLandingPageId: input.retargetLandingPageId ?? null,
    retargetLandingUrl: input.retargetLandingUrl.trim().slice(0, 2000) || null,
    retargetDiscountPercent: Math.min(
      90,
      Math.max(0, Math.round(input.retargetDiscountPercent || 0))
    ),
    retargetDelayDays: Math.min(
      90,
      Math.max(0, Math.round(input.retargetDelayDays || 0))
    ),
    retargetMessage:
      input.retargetMessage.trim().slice(0, 4000) ||
      TRACKING_RETARGET_DEFAULTS.retargetMessage,
  };
  await db
    .insert(trackingRetargetSettings)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  return getTrackingRetargetSettings(storeId);
}

function decryptSettingsToken(row: TrackingRetargetSettings | null) {
  if (!row?.whatsappTokenEncrypted || !row.whatsappPhoneId) return undefined;
  try {
    return {
      phoneId: row.whatsappPhoneId,
      token: decryptSecret(row.whatsappTokenEncrypted),
    };
  } catch {
    return undefined;
  }
}

export async function getTrackingWhatsappSender(storeId: number) {
  const row = await getTrackingRetargetSettingsRow(storeId);
  if (!row?.enabled || !row.whatsappPhoneId) return undefined;
  return decryptSettingsToken(row);
}

export type PublicTrackingBox = {
  enabled: true;
  trackTitle: string;
  trackHint: string;
  trackCta: string;
  trackMessage: string;
  activeNumber: string;
};

export async function getPublicTrackingBox(
  productId: number
): Promise<PublicTrackingBox | null> {
  const db = await getDb();
  if (!db) return null;
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(eq(storeProducts.id, productId))
    .limit(1);
  if (!product?.storeId) return null;
  const row = await getTrackingRetargetSettingsRow(product.storeId);
  if (!row?.enabled) return null;
  const numbers = parseNumbers(row.supportNumbersJson);
  const active = numbers.find(number => number.active);
  if (!active) return null;
  return {
    enabled: true as const,
    trackTitle: row.trackTitle || TRACKING_RETARGET_DEFAULTS.trackTitle,
    trackHint: row.trackHint || TRACKING_RETARGET_DEFAULTS.trackHint,
    trackCta: row.trackCta || TRACKING_RETARGET_DEFAULTS.trackCta,
    trackMessage: row.trackMessage || TRACKING_RETARGET_DEFAULTS.trackMessage,
    activeNumber: active.number,
  };
}

export type TrackingRetargetAnalytics = {
  statusSent: number;
  retargetSent: number;
  retargetRedeemed: number;
  pendingRetargets: number;
  scheduledRetargets: number;
};

export async function getTrackingRetargetAnalytics(
  storeId: number
): Promise<TrackingRetargetAnalytics> {
  const db = await getDb();
  if (!db)
    return {
      statusSent: 0,
      retargetSent: 0,
      retargetRedeemed: 0,
      pendingRetargets: 0,
      scheduledRetargets: 0,
    };
  const [status] = await db
    .select({ value: count() })
    .from(trackingRetargetSends)
    .where(
      and(
        eq(trackingRetargetSends.storeId, storeId),
        eq(trackingRetargetSends.kind, "status"),
        eq(trackingRetargetSends.ok, true)
      )
    );
  const [retarget] = await db
    .select({ value: count() })
    .from(trackingRetargetSends)
    .where(
      and(
        eq(trackingRetargetSends.storeId, storeId),
        eq(trackingRetargetSends.kind, "retarget"),
        eq(trackingRetargetSends.ok, true)
      )
    );
  const [redeemed] = await db
    .select({ value: count() })
    .from(trackingRetargetSends)
    .where(
      and(
        eq(trackingRetargetSends.storeId, storeId),
        eq(trackingRetargetSends.kind, "redeem"),
        eq(trackingRetargetSends.ok, true)
      )
    );
  const pendingRows = await db
    .select({
      status: trackingRetargetOrderStates.retargetStatus,
      dueAt: trackingRetargetOrderStates.retargetDueAt,
    })
    .from(trackingRetargetOrderStates)
    .where(eq(trackingRetargetOrderStates.storeId, storeId));
  return {
    statusSent: Number(status?.value ?? 0),
    retargetSent: Number(retarget?.value ?? 0),
    retargetRedeemed: Number(redeemed?.value ?? 0),
    pendingRetargets: pendingRows.filter(row => row.status === "pending")
      .length,
    scheduledRetargets: pendingRows.filter(
      row => row.status === "pending" && row.dueAt != null
    ).length,
  };
}

export async function getOrderTrackingState(
  orderId: number
): Promise<TrackingRetargetOrderState | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(trackingRetargetOrderStates)
    .where(eq(trackingRetargetOrderStates.orderId, orderId))
    .limit(1);
  return row ?? null;
}

export async function ensureOrderTrackingState(
  ownerId: number,
  storeId: number | null,
  orderId: number
): Promise<TrackingRetargetOrderState> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const existing = await getOrderTrackingState(orderId);
  if (existing) return existing;
  await db
    .insert(trackingRetargetOrderStates)
    .values({
      ownerId,
      storeId: storeId ?? null,
      orderId,
      retargetStatus: "none",
    })
    .onDuplicateKeyUpdate({ set: {} });
  const row = await getOrderTrackingState(orderId);
  if (!row) throw new Error("تعذر تجهيز سجل متابعة الطلب.");
  return row;
}

export async function updateOrderTrackingState(
  orderId: number,
  patch: Partial<
    Pick<
      TrackingRetargetOrderState,
      | "lastStatusSent"
      | "deliveredAt"
      | "retargetDueAt"
      | "retargetStatus"
      | "retargetAttempts"
      | "retargetSentAt"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .update(trackingRetargetOrderStates)
    .set(patch)
    .where(eq(trackingRetargetOrderStates.orderId, orderId));
  const row = await getOrderTrackingState(orderId);
  return row;
}

export async function listDueRetargetStates(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(trackingRetargetOrderStates)
    .where(
      and(
        eq(trackingRetargetOrderStates.retargetStatus, "pending"),
        lt(trackingRetargetOrderStates.retargetDueAt, now),
        gt(trackingRetargetOrderStates.retargetDueAt, new Date(0))
      )
    )
    .orderBy(trackingRetargetOrderStates.retargetDueAt)
    .limit(limit);
}

export async function listRecentlySent(storeId: number, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trackingRetargetSends)
    .where(eq(trackingRetargetSends.storeId, storeId))
    .orderBy(desc(trackingRetargetSends.createdAt))
    .limit(limit);
}

export async function logTrackingRetargetSend(input: {
  ownerId: number;
  storeId: number | null;
  orderId?: number;
  kind: "status" | "retarget" | "redeem";
  statusLabel?: string;
  toPhone?: string;
  message?: string;
  ok: boolean;
  error?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(trackingRetargetSends).values({
    ownerId: input.ownerId,
    storeId: input.storeId ?? null,
    orderId: input.orderId ?? null,
    kind: input.kind,
    statusLabel: input.statusLabel ?? null,
    toPhone: input.toPhone ?? null,
    message: input.message?.slice(0, 4000) ?? null,
    ok: input.ok,
    error: input.error?.slice(0, 500) ?? null,
  });
}

export async function getStoreForOrder(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.id, orderId))
    .limit(1);
  if (!order) return undefined;
  const [store] =
    order.storeId != null
      ? await db
          .select()
          .from(stores)
          .where(eq(stores.id, order.storeId))
          .limit(1)
      : [];
  return { order, store: store ?? null };
}
