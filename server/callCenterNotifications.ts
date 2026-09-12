import { and, eq } from "drizzle-orm";
import { callCenterAgentProducts, callCenterAgents } from "../drizzle/schema";
import { getDb, getGoogleOAuthConnection } from "./db";
import { ENV } from "./_core/env";

type EventKind =
  "new_order" | "status_change" | "cancelled" | "unresponsive" | "follow_up";
type NotificationOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  wilaya: string;
  deliveryMethod?: string;
  fulfillmentStatus?: string;
};

async function accessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.googleOAuthClientId,
      client_secret: ENV.googleOAuthClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw new Error(
      "تعذر تجديد تصريح Gmail. أعد ربط حساب Google من Connecteurs."
    );
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("لم تُرجع Google تصريح Gmail.");
  return data.access_token;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendGmailMessage(
  refreshToken: string,
  sender: string,
  recipient: string,
  subject: string,
  body: string
) {
  const token = await accessToken(refreshToken);
  const raw = [
    `From: ${sender}`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeBase64Url(raw) }),
    }
  );
  if (!response.ok)
    throw new Error(
      "تعذر إرسال إشعار Gmail. تأكد من إعادة ربط Google ومنح صلاحية الإرسال."
    );
}

const statusLabel: Record<string, string> = {
  new: "جديد",
  review: "قيد المراجعة",
  confirmed: "مؤكد",
  processing: "قيد التحضير",
  at_carrier: "عند شركة التوصيل",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
  customer_unresponsive: "الزبون لا يرد",
  phone_cancelled: "الهاتف ملغى",
  fake: "مزيف",
};

export function buildCallCenterEmail(
  event: EventKind,
  order: NotificationOrder
) {
  const kindLabel =
    event === "new_order"
      ? "طلب جديد"
      : event === "cancelled"
        ? "طلب ملغى"
        : event === "unresponsive"
          ? "طلب يحتاج متابعة"
          : event === "status_change"
            ? "تحديث حالة طلب"
            : "متابعة طلب";
  const subject = `عبدو ستور · ${kindLabel} · ${order.orderNumber}`;
  const body = [
    `مرحبًا،`,
    `لديك ${kindLabel} مرتبط بأحد المنتجات المسموحة لحسابك في مركز الاتصال.`,
    "",
    `رقم الطلب: ${order.orderNumber}`,
    `الزبون: ${order.customerName}`,
    `الهاتف: ${order.customerPhone}`,
    `الولاية: ${order.wilaya}`,
    `الإجمالي: ${order.total} دج`,
    order.deliveryMethod
      ? `التوصيل: ${order.deliveryMethod === "office" ? "مكتب" : "منزل"}`
      : "",
    order.fulfillmentStatus
      ? `الحالة: ${statusLabel[order.fulfillmentStatus] ?? order.fulfillmentStatus}`
      : "",
    "",
    "يمكنك الدخول إلى لوحة مركز الاتصال لمتابعة الطلب.",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, body };
}

export async function notifyCallCenterAgents(
  ownerId: number,
  productIds: number[],
  event: EventKind,
  order: NotificationOrder
) {
  if (!productIds.length) return { sent: 0, skipped: 0 };
  const db = await getDb();
  if (!db) return { sent: 0, skipped: 0 };
  const connection = await getGoogleOAuthConnection(ownerId);
  if (!connection?.refreshToken || !connection.email) {
    console.warn(
      "[Call Center] Gmail notifications skipped: Google OAuth is not connected."
    );
    return { sent: 0, skipped: 0 };
  }
  const setting =
    event === "new_order"
      ? callCenterAgents.notifyNewOrders
      : event === "cancelled"
        ? callCenterAgents.notifyCancelledOrders
        : event === "unresponsive"
          ? callCenterAgents.notifyUnresponsiveOrders
          : event === "status_change"
            ? callCenterAgents.notifyStatusChanges
            : callCenterAgents.notifyFollowUp;
  const recipients = await db
    .select({ email: callCenterAgents.email })
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.storeId, ownerId),
        eq(callCenterAgents.enabled, true),
        eq(setting, true)
      )
    );
  const scopedRows = await db
    .select({
      agentId: callCenterAgentProducts.agentId,
      productId: callCenterAgentProducts.productId,
    })
    .from(callCenterAgentProducts)
    .innerJoin(
      callCenterAgents,
      eq(callCenterAgentProducts.agentId, callCenterAgents.id)
    )
    .where(eq(callCenterAgents.storeId, ownerId));
  const productSet = new Set(productIds);
  const byAgent = new Map<number, Set<number>>();
  for (const row of scopedRows) {
    if (!byAgent.has(row.agentId)) byAgent.set(row.agentId, new Set());
    byAgent.get(row.agentId)!.add(row.productId);
  }
  const agentIdByEmail = new Map<string, number>();
  for (const agent of await db
    .select({ id: callCenterAgents.id, email: callCenterAgents.email })
    .from(callCenterAgents)
    .where(eq(callCenterAgents.storeId, ownerId))) {
    agentIdByEmail.set(agent.email, agent.id);
  }
  const matchingEmails = new Set<string>();
  for (const agent of recipients) {
    const agentId = agentIdByEmail.get(agent.email);
    const agentProducts = agentId ? byAgent.get(agentId) : undefined;
    const matches =
      !agentProducts || agentProducts.size === 0
        ? true
        : Array.from(agentProducts).some(productId =>
            productSet.has(productId)
          );
    if (matches) matchingEmails.add(agent.email);
  }
  const uniqueRecipients = Array.from(matchingEmails);
  const { subject, body } = buildCallCenterEmail(event, order);
  const results = await Promise.allSettled(
    uniqueRecipients.map(recipient =>
      sendGmailMessage(
        connection.refreshToken,
        connection.email!,
        recipient,
        subject,
        body
      )
    )
  );
  const sent = results.filter(result => result.status === "fulfilled").length;
  results
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )
    .forEach(result =>
      console.warn("[Call Center] Gmail delivery failed:", result.reason)
    );
  return { sent, skipped: uniqueRecipients.length - sent };
}
