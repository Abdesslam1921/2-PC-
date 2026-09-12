import { getGoogleOAuthConnection, listStoreOrders } from "./db";
import { ENV } from "./_core/env";

type OAuthConnection = {
  refreshToken: string;
  accessToken?: string;
  email?: string;
};

async function accessToken(connection: OAuthConnection) {
  if (!ENV.googleOAuthClientId || !ENV.googleOAuthClientSecret)
    throw new Error("إعدادات Google OAuth غير مكتملة على مستوى المنصة.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.googleOAuthClientId,
      client_secret: ENV.googleOAuthClientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw new Error("تعذر تجديد تصريح Google Sheets. أعد ربط حساب Google.");
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("لم تُرجع Google تصريح الوصول.");
  return data.access_token;
}

export async function syncOrdersToGoogleSheet(
  storeId: number,
  spreadsheetId: string
) {
  const connection = await getGoogleOAuthConnection(storeId);
  if (!connection) throw new Error("اربط حساب Google أولًا.");
  const token = await accessToken(connection);
  const orders = await listStoreOrders(storeId);
  const values = [
    [
      "رقم الطلب",
      "التاريخ",
      "العميل",
      "الهاتف",
      "الولاية",
      "طريقة التوصيل",
      "الإجمالي",
      "الحالة",
    ],
    ...orders.map(order => [
      order.orderNumber || String(order.id),
      new Date(order.createdAt).toISOString(),
      order.customerName,
      order.customerPhone,
      order.wilaya,
      order.deliveryMethod,
      order.total,
      order.fulfillmentStatus,
    ]),
  ];
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/Orders:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ majorDimension: "ROWS", values }),
    }
  );
  if (!response.ok)
    throw new Error(
      "تعذر مزامنة الطلبات مع Google Sheet. تأكد أن الحساب المرتبط يملك صلاحية التعديل."
    );
  return { synced: orders.length } as const;
}
