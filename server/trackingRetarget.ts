import type { TrackingRetargetSettings, stores } from "../drizzle/schema";
import { storeProducts } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  DELIVERED_RAW_STATUSES,
  ensureOrderTrackingState,
  getStoreForOrder,
  getTrackingRetargetSettingsRow,
  getTrackingWhatsappSender,
  listDueRetargetStates,
  logTrackingRetargetSend,
  updateOrderTrackingState,
} from "./trackingRetargetDb";

const DAY_MS = 24 * 60 * 60 * 1000;

const CARRIER_STATUS_ARABIC: Record<string, string> = {
  order_information_received_by_carrier: "تم استلام معلومات الطلب",
  picked: "تم استلام طلبك من طرف شركة التوصيل",
  accepted_by_carrier: "تم قبول طلبك لدى شركة التوصيل",
  dispatched_to_driver: "طلبك في طريقه إلى الموزع للتوصيل",
  attempt_delivery: "المندوب يحاول توصيل طلبك",
  return_asked: "تم طلب إرجاع الطلب",
  return_in_transit: "الطلب في طريق العودة",
  return_received: "تم استلام الطلب المرتجع",
  livred: "تم تسليم طلبك بنجاح ✅",
  encassed: "تم تسليم طلبك وتحصيل قيمته ✅",
  payed: "تم تسليم طلبك وتسديد قيمته ✅",
  delivered: "تم تسليم طلبك بنجاح ✅",
  returned: "تم إرجاع الطلب",
  cancelled: "تم إلغاء الطلب",
  failed: "تعذر تنفيذ التوصيل",
  in_transit: "طلبك قيد التوصيل 🚚",
  out_for_delivery: "طلبك لدى الموزع وجارٍ توصيله",
  processing: "الطلب قيد المعالجة لدى شركة التوصيل",
  pending: "في انتظار معالجة شركة التوصيل",
  suspended: "الطلب معلق حاليًا لدى شركة التوصيل",
  other: "تم تحديث حالة طلبك",
};

const FULFILLMENT_STATUS_ARABIC: Record<string, string> = {
  new: "تم استلام طلبك",
  review: "قيد المراجعة",
  confirmed: "تم تأكيد طلبك",
  processing: "طلبك قيد التحضير",
  at_carrier: "طلبك وصل إلى شركة التوصيل",
  shipped: "تم شحن طلبك 🚚",
  delivered: "تم تسليم طلبك بنجاح ✅",
  returned: "تم إرجاع الطلب",
  cancelled: "تم إلغاء الطلب",
  customer_unresponsive: "تعذر الوصول إليك لتأكيد الطلب",
  phone_cancelled: "تم إلغاء الطلب",
  fake: "تم إيقاف الطلب",
};

export function shipmentStatusArabic(
  raw?: string | null,
  internalStatus?: string | null,
  fulfillmentStatus?: string | null
): string {
  const rawKey = (raw ?? "").trim().toLowerCase();
  if (rawKey && CARRIER_STATUS_ARABIC[rawKey])
    return CARRIER_STATUS_ARABIC[rawKey];
  const internalKey = (internalStatus ?? "").trim().toLowerCase();
  if (internalKey && CARRIER_STATUS_ARABIC[internalKey])
    return CARRIER_STATUS_ARABIC[internalKey];
  const fulfillmentKey = (fulfillmentStatus ?? "").trim().toLowerCase();
  if (fulfillmentKey && FULFILLMENT_STATUS_ARABIC[fulfillmentKey])
    return FULFILLMENT_STATUS_ARABIC[fulfillmentKey];
  return rawKey || fulfillmentKey || internalKey || "تم تحديث حالة طلبك";
}

export function isDeliveredStatus(
  raw?: string | null,
  internalStatus?: string | null,
  fulfillmentStatus?: string | null,
  terminalEvent?: string | null
): boolean {
  if (terminalEvent === "delivered") return true;
  const rawKey = (raw ?? "").trim().toLowerCase();
  if (DELIVERED_RAW_STATUSES.has(rawKey)) return true;
  if ((internalStatus ?? "").trim().toLowerCase() === "delivered") return true;
  if ((fulfillmentStatus ?? "").trim().toLowerCase() === "delivered")
    return true;
  return false;
}

function cleanPhoneForWhatsApp(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 9) return "";
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) return `213${digits.slice(1)}`;
  return digits;
}

export async function sendWhatsAppText(
  sender: { phoneId: string; token: string },
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${encodeURIComponent(sender.phoneId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: text ? text.slice(0, 300) : `WhatsApp HTTP ${response.status}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "WhatsApp send failed",
    };
  }
}

function fillTemplate(template: string, values: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(values))
    result = result.replaceAll(`{${key}}`, value);
  return result;
}

export function publicStoreOrigin(
  store?: { slug?: string | null } | null
): string {
  const override = process.env.RETARGET_PUBLIC_BASE_URL;
  if (override) return override.replace(/\/+$/, "");
  const baseDomain = (
    process.env.APP_BASE_DOMAIN || "abdou-store.com"
  ).toLowerCase();
  if (store?.slug) return `https://${store.slug}.${baseDomain}`;
  return "http://localhost:3000";
}

export function buildRetargetProductUrl(
  store: { slug?: string | null } | null,
  settings: Pick<
    TrackingRetargetSettings,
    | "retargetTargetType"
    | "retargetLandingUrl"
    | "retargetProductId"
    | "retargetDiscountPercent"
  >
): string | null {
  if (!settings.retargetProductId) return null;
  const origin = publicStoreOrigin(store);
  const discount = Math.max(
    1,
    Math.min(90, settings.retargetDiscountPercent || 10)
  );
  let base = `${origin}/p/${settings.retargetProductId}`;
  if (
    settings.retargetTargetType === "landing" &&
    settings.retargetLandingUrl &&
    /^https?:\/\//i.test(settings.retargetLandingUrl)
  ) {
    base = settings.retargetLandingUrl.trim().replace(/\/+$/, "");
  }
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}discount=${discount}`;
}

function deliveredLabelFor(
  raw?: string | null,
  internalStatus?: string | null,
  fulfillmentStatus?: string | null,
  terminalEvent?: string | null
): { delivered: boolean; returned: boolean; label: string } {
  const label = shipmentStatusArabic(raw, internalStatus, fulfillmentStatus);
  if (terminalEvent === "returned")
    return { delivered: false, returned: true, label };
  if (isDeliveredStatus(raw, internalStatus, fulfillmentStatus, terminalEvent))
    return { delivered: true, returned: false, label };
  const rawKey = (raw ?? "").trim().toLowerCase();
  const returned =
    rawKey === "return_received" ||
    rawKey === "returned" ||
    terminalEvent === "returned" ||
    (internalStatus ?? "").trim().toLowerCase() === "returned";
  return { delivered: false, returned, label };
}

/**
 * Core webhook used by BOTH the legacy ForShip/Ecotrack sync and the ForShip
 * webhook/polling engine. Sends the buyer a WhatsApp update whenever the raw
 * shipment status label actually changes, and schedules the retargeting
 * message once an order reaches the delivered state.
 *
 * Deliberately non-fatal: any failure is logged and swallowed so tracking
 * updates never break the underlying order sync.
 */
export async function notifyOrderTrackingStatus(
  orderId: number,
  context?: {
    raw?: string | null;
    internalStatus?: string | null;
    fulfillmentStatus?: string | null;
    terminalEvent?: "delivered" | "returned" | null;
  }
): Promise<{ notified: boolean; reason: string }> {
  try {
    const found = await getStoreForOrder(orderId);
    if (!found || !found.order.storeId)
      return { notified: false, reason: "no-store" };
    const settings = await getTrackingRetargetSettingsRow(found.order.storeId);
    if (!settings?.enabled || !settings.statusEnabled)
      return { notified: false, reason: "status-disabled" };

    const raw = context?.raw ?? found.order.carrierStatus ?? "";
    const rawKey = String(raw).trim().toLowerCase();
    const internal = context?.internalStatus ?? null;
    const fulfillment =
      context?.fulfillmentStatus ?? found.order.fulfillmentStatus ?? null;
    const terminalEvent = context?.terminalEvent ?? null;
    const dedupeKey = rawKey || internal || fulfillment || "updated";

    const state = await ensureOrderTrackingState(
      found.order.ownerId,
      found.order.storeId,
      orderId
    );
    if (
      state.lastStatusSent &&
      String(state.lastStatusSent).trim().toLowerCase() === dedupeKey
    )
      return { notified: false, reason: "duplicate" };

    const { delivered, returned, label } = deliveredLabelFor(
      raw,
      internal,
      fulfillment,
      terminalEvent
    );
    const sender = await getTrackingWhatsappSender(found.order.storeId);
    const customerPhone = cleanPhoneForWhatsApp(found.order.customerPhone);

    if (sender && customerPhone) {
      const message = fillTemplate(settings.statusMessage, {
        customerName: found.order.customerName,
        orderNumber: found.order.orderNumber,
        status: label,
      });
      const result = await sendWhatsAppText(sender, customerPhone, message);
      await logTrackingRetargetSend({
        ownerId: found.order.ownerId,
        storeId: found.order.storeId,
        orderId,
        kind: "status",
        statusLabel: label,
        toPhone: customerPhone,
        message,
        ok: result.ok,
        error: result.error,
      });
      await updateOrderTrackingState(orderId, { lastStatusSent: dedupeKey });
    } else {
      await updateOrderTrackingState(orderId, { lastStatusSent: dedupeKey });
    }

    if (delivered && settings.retargetEnabled && settings.retargetProductId) {
      await scheduleRetargetForDelivered(
        found.order.ownerId,
        found.order.storeId,
        orderId,
        state.deliveredAt ?? null,
        settings
      );
    } else if (
      returned &&
      (state.retargetStatus === "none" || state.retargetStatus === "pending")
    ) {
      // A returned order never receives a retargeting message.
      await updateOrderTrackingState(orderId, { retargetStatus: "skipped" });
    }
    return { notified: Boolean(sender && customerPhone), reason: "ok" };
  } catch (error) {
    console.warn(
      `[Tracking] status notify skipped for order ${orderId}:`,
      error instanceof Error ? error.message : error
    );
    return { notified: false, reason: "error" };
  }
}

async function scheduleRetargetForDelivered(
  ownerId: number,
  storeId: number,
  orderId: number,
  existingDeliveredAt: Date | null,
  settings: TrackingRetargetSettings
) {
  const deliveredAt = existingDeliveredAt ?? new Date();
  const dueAt = new Date(
    deliveredAt.getTime() +
      Math.max(0, settings.retargetDelayDays || 0) * DAY_MS
  );
  await updateOrderTrackingState(orderId, {
    deliveredAt,
    retargetDueAt: dueAt,
    retargetStatus: "pending",
    retargetAttempts: 0,
  });
}

/**
 * Periodic sweep that actually sends the retargeting (discount) message once
 * the configured delay after delivery has elapsed. Runs piggybacked on the
 * ForShip scheduled sync.
 */
export async function processDueRetargetSends(
  limit = 100
): Promise<{ sent: number; skipped: number; failed: number }> {
  const states = await listDueRetargetStates(limit);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const state of states) {
    try {
      const found = await getStoreForOrder(state.orderId);
      if (!found || !found.order.storeId) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "skipped",
        });
        skipped += 1;
        continue;
      }
      const settings = await getTrackingRetargetSettingsRow(
        found.order.storeId
      );
      if (
        !settings?.enabled ||
        !settings.retargetEnabled ||
        !settings.retargetProductId
      ) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "skipped",
        });
        skipped += 1;
        continue;
      }
      const db = await getDb();
      if (!db) {
        failed += 1;
        continue;
      }
      const [product] = await db
        .select({ id: storeProducts.id, title: storeProducts.title })
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.id, settings.retargetProductId),
            eq(storeProducts.ownerId, settings.ownerId)
          )
        )
        .limit(1);
      const url = buildRetargetProductUrl(found.store, settings);
      if (!product || !url) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "skipped",
        });
        skipped += 1;
        continue;
      }
      const sender = await getTrackingWhatsappSender(found.order.storeId);
      const customerPhone = cleanPhoneForWhatsApp(found.order.customerPhone);
      if (!sender || !customerPhone) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "skipped",
        });
        skipped += 1;
        continue;
      }
      const message = fillTemplate(settings.retargetMessage, {
        customerName: found.order.customerName,
        orderNumber: found.order.orderNumber,
        discount: String(settings.retargetDiscountPercent ?? 0),
        productTitle: product.title,
        productLink: url,
      });
      const attempts = (state.retargetAttempts ?? 0) + 1;
      const result = await sendWhatsAppText(sender, customerPhone, message);
      await logTrackingRetargetSend({
        ownerId: found.order.ownerId,
        storeId: found.order.storeId,
        orderId: state.orderId,
        kind: "retarget",
        toPhone: customerPhone,
        message,
        ok: result.ok,
        error: result.error,
      });
      if (result.ok) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "sent",
          retargetSentAt: new Date(),
          retargetAttempts: attempts,
        });
        sent += 1;
      } else if (attempts >= 5) {
        await updateOrderTrackingState(state.orderId, {
          retargetStatus: "skipped",
          retargetAttempts: attempts,
        });
        skipped += 1;
      } else {
        await updateOrderTrackingState(state.orderId, {
          retargetAttempts: attempts,
        });
        failed += 1;
      }
    } catch (error) {
      console.warn(
        `[Tracking] retarget failed for state ${state.id}:`,
        error instanceof Error ? error.message : error
      );
      failed += 1;
    }
  }
  return { sent, skipped, failed };
}
