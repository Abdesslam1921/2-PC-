import type { storeOrders, storeOrderItems } from "../drizzle/schema";

type Order = typeof storeOrders.$inferSelect;
type OrderItem = typeof storeOrderItems.$inferSelect;

export type EcotrackCredentials = { baseUrl: string; token: string };
export type EcotrackOrder = {
  reference: string;
  nom_client: string;
  telephone: string;
  adresse: string;
  commune: string;
  code_wilaya: number;
  montant: string;
  remarque?: string;
  produit?: string;
  quantite?: string;
  type: 1 | 2 | 3 | 4;
  stop_desk: 0 | 1;
};

function endpoint(credentials: EcotrackCredentials, path: string) {
  const base = credentials.baseUrl.replace(/\/+$/, "");
  return `${base}/api/v1/${path.replace(/^\/+/, "")}`;
}

async function request(
  credentials: EcotrackCredentials,
  path: string,
  init: RequestInit = {}
) {
  const separator = path.includes("?") ? "&" : "?";
  const authenticatedPath = `${path}${separator}api_token=${encodeURIComponent(credentials.token)}`;
  const response = await fetch(endpoint(credentials, authenticatedPath), {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* keep non-JSON response */
  }
  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message;
    throw new Error(message || `Ecotrack HTTP ${response.status}`);
  }
  return { response, payload };
}

export async function validateEcotrackToken(credentials: EcotrackCredentials) {
  const url = `${endpoint(credentials, "validate/token")}?api_token=${encodeURIComponent(credentials.token)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  if (!response.ok || payload.success !== true)
    throw new Error(payload.message || `Ecotrack HTTP ${response.status}`);
  return payload;
}

export async function createEcotrackOrders(
  credentials: EcotrackCredentials,
  orders: EcotrackOrder[]
) {
  if (!orders.length || orders.length > 100)
    throw new Error("يسمح Ecotrack بحد أقصى 100 طلب في الرفع الواحد.");
  const body = {
    orders: Object.fromEntries(
      orders.map((order, index) => [String(index), order])
    ),
  };
  return request(credentials, "create/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

type EcotrackResult = {
  success?: boolean;
  tracking?: string;
  [key: string]: unknown;
};

function resultMap(payload: unknown): Record<string, EcotrackResult> {
  const results = (payload as { results?: unknown } | null)?.results;
  return results && typeof results === "object"
    ? (results as Record<string, EcotrackResult>)
    : {};
}

export function extractEcotrackTrackings(payload: unknown) {
  return Object.entries(resultMap(payload)).flatMap(([reference, result]) =>
    result?.success === true &&
    typeof result.tracking === "string" &&
    result.tracking
      ? [{ reference, tracking: result.tracking }]
      : []
  );
}

function translateEcotrackError(message: string) {
  if (/Aucun bureau n'est disponible/i.test(message))
    return "لا يوجد مكتب Ecotrack متاح لهذه البلدية. اختر التوصيل إلى المنزل أو اختر بلدية فيها مكتب متاح.";
  if (/Commune mal écrite|désactivée/i.test(message))
    return "البلدية غير مطابقة أو غير مفعلة لدى Ecotrack.";
  return message;
}

export function extractEcotrackFailures(payload: unknown) {
  return Object.entries(resultMap(payload)).flatMap(([reference, result]) => {
    if (result?.success === true) return [];
    const details = Object.entries(result ?? {})
      .filter(([key]) => key !== "success" && key !== "tracking")
      .flatMap(([, value]) =>
        Array.isArray(value)
          ? value.map(String)
          : typeof value === "string"
            ? [value]
            : []
      );
    return [
      {
        reference,
        message: translateEcotrackError(
          details.join("؛ ") || "رفضت Ecotrack الطلب دون تفاصيل إضافية."
        ),
      },
    ];
  });
}

export async function shipEcotrackOrder(
  credentials: EcotrackCredentials,
  tracking: string,
  askCollection = false
) {
  return request(
    credentials,
    `valid/order?tracking=${encodeURIComponent(tracking)}&ask_collection=${askCollection ? 1 : 0}`,
    { method: "POST" }
  );
}

export async function downloadEcotrackLabel(
  credentials: EcotrackCredentials,
  tracking: string
) {
  const response = await fetch(
    `${endpoint(credentials, "get/order/label")}?tracking=${encodeURIComponent(tracking)}&api_token=${encodeURIComponent(credentials.token)}`,
    {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: "application/pdf",
      },
    }
  );
  if (!response.ok) throw new Error(`Ecotrack HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export function toEcotrackOrder(
  order: Order,
  items: OrderItem[],
  officeCommune?: string
): EcotrackOrder {
  const wilayaCode = Number.parseInt(
    order.wilayaCode ?? order.wilaya.match(/^\d{1,2}/)?.[0] ?? "0",
    10
  );
  if (!wilayaCode)
    throw new Error(`تعذر تحديد رمز ولاية الطلب ${order.orderNumber}.`);
  const isOffice = order.deliveryMethod === "office";
  const commune = isOffice
    ? officeCommune?.trim() || order.carrierMunicipality?.trim()
    : order.carrierMunicipality?.trim() || order.municipality?.trim();
  if (!commune)
    throw new Error(
      `اسم البلدية المعتمد لـEcotrack غير متوفر في الطلب ${order.orderNumber}. أعد إنشاء الطلب بعد تحديث قائمة البلديات.`
    );
  return {
    reference: order.orderNumber,
    nom_client: order.customerName,
    telephone: order.customerPhone,
    adresse: order.address,
    commune,
    code_wilaya: wilayaCode,
    montant: order.total,
    remarque: order.notes || undefined,
    produit:
      items
        .map(item => item.title)
        .join(", ")
        .slice(0, 255) || undefined,
    quantite: items.map(item => String(item.quantity)).join(",") || undefined,
    type: 1,
    stop_desk: isOffice ? 1 : 0,
  };
}

const documentedTrackingStatuses = [
  "order_information_received_by_carrier",
  "picked",
  "accepted_by_carrier",
  "dispatched_to_driver",
  "attempt_delivery",
  "return_asked",
  "return_in_transit",
  "return_received",
  "livred",
  "encassed",
  "payed",
] as const;
export type EcotrackTrackingStatus =
  (typeof documentedTrackingStatuses)[number];

function findTrackingStatuses(
  value: unknown,
  found: EcotrackTrackingStatus[] = []
) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if ((documentedTrackingStatuses as readonly string[]).includes(normalized))
      found.push(normalized as EcotrackTrackingStatus);
  } else if (Array.isArray(value))
    value.forEach(item => findTrackingStatuses(item, found));
  else if (value && typeof value === "object")
    Object.values(value).forEach(item => findTrackingStatuses(item, found));
  return found;
}

export async function getEcotrackTrackingInfo(
  credentials: EcotrackCredentials,
  tracking: string
) {
  const result = await request(
    credentials,
    `get/tracking/info?tracking=${encodeURIComponent(tracking)}`
  );
  const payload = result.payload as {
    success?: boolean;
    message?: string;
  } | null;
  if (
    payload &&
    typeof payload === "object" &&
    payload.success === false &&
    /inexistante|introuvable|not found|n'existe/i.test(payload.message ?? "")
  ) {
    // The shipment was deleted/does not exist at the carrier. Surface it as a
    // "not found" error so sync callers mark the order cancelled.
    throw new Error("Order not found (Commande inexistante)");
  }
  const statuses = findTrackingStatuses(result.payload);
  return { ...result, status: statuses.at(-1) ?? null, statuses };
}
