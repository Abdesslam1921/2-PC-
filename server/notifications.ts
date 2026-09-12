import { getNotificationSettings } from "./db";

type OrderNotification = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  wilaya: string;
  deliveryMethod: string;
};

function message(order: OrderNotification) {
  return `طلب جديد ${order.orderNumber}\nالعميل: ${order.customerName}\nالهاتف: ${order.customerPhone}\nالولاية: ${order.wilaya}\nالتوصيل: ${order.deliveryMethod === "office" ? "المكتب" : "المنزل"}\nالإجمالي: ${order.total} دج`;
}

export async function notifyNewOrder(
  ownerId: number,
  order: OrderNotification
) {
  const settings = await getNotificationSettings(ownerId);
  if (!settings) return { delivered: 0 };
  const body = message(order);
  const jobs: Promise<unknown>[] = [];
  if (
    settings.whatsappPhoneId &&
    settings.whatsappToken &&
    settings.whatsappRecipient
  ) {
    jobs.push(
      fetch(
        `https://graph.facebook.com/v23.0/${encodeURIComponent(settings.whatsappPhoneId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.whatsappToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: settings.whatsappRecipient,
            type: "text",
            text: { body },
          }),
        }
      )
    );
  }
  if (settings.telegramBotToken && settings.telegramChatId) {
    jobs.push(
      fetch(
        `https://api.telegram.org/bot${encodeURIComponent(settings.telegramBotToken)}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: body,
          }),
        }
      )
    );
  }
  if (
    settings.smsApiUrl &&
    settings.smsApiKey &&
    settings.smsProvider &&
    settings.smsRecipient
  ) {
    jobs.push(
      fetch(settings.smsApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.smsApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: settings.smsRecipient,
          message: body,
          provider: settings.smsProvider,
        }),
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  const delivered = results.filter(
    result =>
      result.status === "fulfilled" &&
      result.value instanceof Response &&
      result.value.ok
  ).length;
  if (results.some(result => result.status === "rejected"))
    console.warn("[Notifications] one or more delivery attempts failed");
  return { delivered };
}
