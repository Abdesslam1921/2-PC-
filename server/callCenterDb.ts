import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  callCenterAgentProducts,
  callCenterAgents,
  callCenterSessions,
  storeProducts,
} from "../drizzle/schema";
import {
  getDb,
  getCarrierCredentials,
  getNotificationSettings,
  listStoreOrders,
  updateOrderCarrierData,
  updateStoreOrderStatus,
  deleteStoreOrdersBulk,
  deleteArchivedOrder,
} from "./db";
import { getEcotrackTrackingInfo } from "./ecotrack";

const SESSION_DAYS = 7;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function calculatePerOrderCompensation(
  mode: "all_orders" | "completed_orders",
  rate: string,
  confirmedOrders: number,
  completedOrders: number
) {
  const eligibleOrders =
    mode === "completed_orders" ? completedOrders : confirmedOrders;
  return {
    eligibleOrders,
    rate,
    estimatedCompensation: (eligibleOrders * Number(rate)).toFixed(2),
    unit: "per_order" as const,
  };
}

export async function listCallCenterAgents(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const agents = await db
    .select({
      id: callCenterAgents.id,
      name: callCenterAgents.name,
      email: callCenterAgents.email,
      enabled: callCenterAgents.enabled,
      notifyNewOrders: callCenterAgents.notifyNewOrders,
      notifyStatusChanges: callCenterAgents.notifyStatusChanges,
      notifyCancelledOrders: callCenterAgents.notifyCancelledOrders,
      notifyUnresponsiveOrders: callCenterAgents.notifyUnresponsiveOrders,
      notifyFollowUp: callCenterAgents.notifyFollowUp,
      compensationMode: callCenterAgents.compensationMode,
      generalOrderRate: callCenterAgents.generalOrderRate,
      completedOrderRate: callCenterAgents.completedOrderRate,
      createdAt: callCenterAgents.createdAt,
    })
    .from(callCenterAgents)
    .where(eq(callCenterAgents.storeId, storeId))
    .orderBy(desc(callCenterAgents.createdAt));
  const orders = await listStoreOrders(storeId);
  return Promise.all(
    agents.map(async agent => {
      const productIds = (
        await db
          .select({ productId: callCenterAgentProducts.productId })
          .from(callCenterAgentProducts)
          .where(eq(callCenterAgentProducts.agentId, agent.id))
      ).map(row => row.productId);
      const fullAccess = productIds.length === 0;
      const visibleOrders = orders.filter(
        order =>
          fullAccess ||
          order.items.some(item => productIds.includes(item.productId))
      );
      const total = visibleOrders.length;
      const completed = visibleOrders.filter(
        order => order.fulfillmentStatus === "delivered"
      ).length;
      const confirmed = visibleOrders.filter(order =>
        [
          "confirmed",
          "processing",
          "at_carrier",
          "shipped",
          "delivered",
        ].includes(order.fulfillmentStatus)
      ).length;
      const shipped = visibleOrders.filter(order =>
        ["at_carrier", "shipped", "delivered"].includes(order.fulfillmentStatus)
      ).length;
      const cancelled = visibleOrders.filter(order =>
        ["cancelled", "phone_cancelled", "fake"].includes(
          order.fulfillmentStatus
        )
      ).length;
      const unresponsive = visibleOrders.filter(
        order => order.fulfillmentStatus === "customer_unresponsive"
      ).length;
      const compensation = calculatePerOrderCompensation(
        agent.compensationMode,
        agent.compensationMode === "completed_orders"
          ? agent.completedOrderRate
          : agent.generalOrderRate,
        confirmed,
        completed
      );
      return {
        ...agent,
        productIds,
        fullAccess,
        stats: {
          total,
          confirmed,
          shipped,
          cancelled,
          unresponsive,
          completed,
          ...compensation,
          confirmationRate: total ? Math.round((confirmed / total) * 100) : 0,
          shippingRate: total ? Math.round((shipped / total) * 100) : 0,
        },
        compensation: {
          mode: agent.compensationMode,
          rate: compensation.rate,
          unit: compensation.unit,
        },
      };
    })
  );
}

export async function createCallCenterAgent(
  ownerId: number,
  storeId: number,
  input: {
    name: string;
    email: string;
    password: string;
    productIds: number[];
    notifyNewOrders: boolean;
    notifyStatusChanges: boolean;
    notifyCancelledOrders: boolean;
    notifyUnresponsiveOrders: boolean;
    notifyFollowUp: boolean;
    compensationMode: "all_orders" | "completed_orders";
    generalOrderRate: string;
    completedOrderRate: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const email = input.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: callCenterAgents.id })
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.storeId, storeId),
        eq(callCenterAgents.email, email)
      )
    )
    .limit(1);
  if (existing) throw new Error("هذا البريد مستخدم لعميل آخر.");
  const validProducts = input.productIds.length
    ? await db
        .select({ id: storeProducts.id })
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            inArray(storeProducts.id, input.productIds)
          )
        )
    : [];
  const created = await db
    .insert(callCenterAgents)
    .values({
      ownerId,
      storeId,
      name: input.name.trim(),
      email,
      passwordHash: hashPassword(input.password),
      enabled: true,
      notifyNewOrders: input.notifyNewOrders,
      notifyStatusChanges: input.notifyStatusChanges,
      notifyCancelledOrders: input.notifyCancelledOrders,
      notifyUnresponsiveOrders: input.notifyUnresponsiveOrders,
      notifyFollowUp: input.notifyFollowUp,
      compensationMode: input.compensationMode,
      generalOrderRate: input.generalOrderRate,
      completedOrderRate: input.completedOrderRate,
    });
  const agentId = Number(created[0]?.insertId);
  if (!agentId) throw new Error("تعذر إنشاء حساب العميل.");
  if (validProducts.length)
    await db
      .insert(callCenterAgentProducts)
      .values(
        validProducts.map(product => ({ agentId, productId: product.id }))
      );
  return {
    id: agentId,
    name: input.name.trim(),
    email,
    enabled: true,
    notifyNewOrders: input.notifyNewOrders,
    notifyStatusChanges: input.notifyStatusChanges,
    notifyCancelledOrders: input.notifyCancelledOrders,
    notifyUnresponsiveOrders: input.notifyUnresponsiveOrders,
    notifyFollowUp: input.notifyFollowUp,
    compensationMode: input.compensationMode,
    generalOrderRate: input.generalOrderRate,
    completedOrderRate: input.completedOrderRate,
    productIds: validProducts.map(product => product.id),
  };
}

export async function updateCallCenterAgent(
  storeId: number,
  agentId: number,
  input: {
    name: string;
    email: string;
    password?: string;
    enabled: boolean;
    notifyNewOrders: boolean;
    notifyStatusChanges: boolean;
    notifyCancelledOrders: boolean;
    notifyUnresponsiveOrders: boolean;
    notifyFollowUp: boolean;
    compensationMode: "all_orders" | "completed_orders";
    generalOrderRate: string;
    completedOrderRate: string;
    productIds: number[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [agent] = await db
    .select()
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.id, agentId),
        eq(callCenterAgents.storeId, storeId)
      )
    )
    .limit(1);
  if (!agent) throw new Error("حساب العميل غير موجود.");
  const validProducts = input.productIds.length
    ? await db
        .select({ id: storeProducts.id })
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.storeId, storeId),
            inArray(storeProducts.id, input.productIds)
          )
        )
    : [];
  await db
    .update(callCenterAgents)
    .set({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      enabled: input.enabled,
      notifyNewOrders: input.notifyNewOrders,
      notifyStatusChanges: input.notifyStatusChanges,
      notifyCancelledOrders: input.notifyCancelledOrders,
      notifyUnresponsiveOrders: input.notifyUnresponsiveOrders,
      notifyFollowUp: input.notifyFollowUp,
      compensationMode: input.compensationMode,
      generalOrderRate: input.generalOrderRate,
      completedOrderRate: input.completedOrderRate,
      ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
    })
    .where(eq(callCenterAgents.id, agentId));
  await db
    .delete(callCenterAgentProducts)
    .where(eq(callCenterAgentProducts.agentId, agentId));
  if (validProducts.length)
    await db
      .insert(callCenterAgentProducts)
      .values(
        validProducts.map(product => ({ agentId, productId: product.id }))
      );
  return {
    id: agentId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    enabled: input.enabled,
    notifyNewOrders: input.notifyNewOrders,
    notifyStatusChanges: input.notifyStatusChanges,
    notifyCancelledOrders: input.notifyCancelledOrders,
    notifyUnresponsiveOrders: input.notifyUnresponsiveOrders,
    notifyFollowUp: input.notifyFollowUp,
    compensationMode: input.compensationMode,
    generalOrderRate: input.generalOrderRate,
    completedOrderRate: input.completedOrderRate,
    productIds: validProducts.map(product => product.id),
  };
}

export async function deleteCallCenterAgent(storeId: number, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [agent] = await db
    .select({ id: callCenterAgents.id })
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.id, agentId),
        eq(callCenterAgents.storeId, storeId)
      )
    )
    .limit(1);
  if (!agent) throw new Error("حساب العميل غير موجود.");
  await db
    .delete(callCenterSessions)
    .where(eq(callCenterSessions.agentId, agentId));
  await db
    .delete(callCenterAgentProducts)
    .where(eq(callCenterAgentProducts.agentId, agentId));
  await db.delete(callCenterAgents).where(eq(callCenterAgents.id, agentId));
  return { success: true } as const;
}

export async function loginCallCenterAgent(input: {
  email: string;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [agent] = await db
    .select()
    .from(callCenterAgents)
    .where(eq(callCenterAgents.email, input.email.trim().toLowerCase()))
    .limit(1);
  if (
    !agent ||
    !agent.enabled ||
    !verifyPassword(input.password, agent.passwordHash)
  )
    throw new Error("البريد أو كلمة المرور غير صحيحة.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(callCenterSessions)
    .values({ agentId: agent.id, tokenHash: hashToken(token), expiresAt });
  return {
    token,
    agent: {
      id: agent.id,
      ownerId: agent.ownerId,
      name: agent.name,
      email: agent.email,
    },
  };
}

export async function createCallCenterAgentSession(
  storeId: number,
  agentId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [agent] = await db
    .select()
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.id, agentId),
        eq(callCenterAgents.storeId, storeId)
      )
    )
    .limit(1);
  if (!agent) throw new Error("حساب العميل غير موجود.");
  if (!agent.enabled)
    throw new Error("حساب العميل متوقف. فعّله أولاً قبل الدخول إليه.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(callCenterSessions)
    .values({ agentId: agent.id, tokenHash: hashToken(token), expiresAt });
  return {
    token,
    agent: {
      id: agent.id,
      ownerId: agent.ownerId,
      name: agent.name,
      email: agent.email,
    },
  };
}

export async function getCallCenterAgentByToken(token: string) {
  const agent = await getAgentByToken(token);
  if (!agent) throw new Error("جلسة الدخول منتهية أو غير صالحة.");
  return agent;
}

export async function listCallCenterAgentProductIds(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ productId: callCenterAgentProducts.productId })
    .from(callCenterAgentProducts)
    .where(eq(callCenterAgentProducts.agentId, agentId));
  return rows.map(row => row.productId);
}

async function getAgentByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({ agent: callCenterAgents, session: callCenterSessions })
    .from(callCenterSessions)
    .innerJoin(
      callCenterAgents,
      eq(callCenterSessions.agentId, callCenterAgents.id)
    )
    .where(eq(callCenterSessions.tokenHash, hashToken(token)))
    .limit(1);
  if (
    !row ||
    row.session.expiresAt.getTime() <= Date.now() ||
    !row.agent.enabled
  )
    return undefined;
  return row.agent;
}

async function listStoreProductsOfStore(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: storeProducts.id, title: storeProducts.title })
    .from(storeProducts)
    .where(eq(storeProducts.storeId, storeId));
}

/** Resolve the agent's effective order scope.
 *  `productIds` empty means full store access (all products and all orders).
 */
export async function resolveCallCenterScope(token: string) {
  const agent = await getCallCenterAgentByToken(token);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const productIds = await listCallCenterAgentProductIds(agent.id);
  const fullAccess = productIds.length === 0;
  const products = fullAccess
    ? await listStoreProductsOfStore(agent.storeId ?? 0)
    : productIds.length
      ? await db
          .select({ id: storeProducts.id, title: storeProducts.title })
          .from(storeProducts)
          .where(
            and(
              eq(storeProducts.storeId, agent.storeId ?? 0),
              inArray(storeProducts.id, productIds)
            )
          )
      : [];
  const isOrderVisible = (order: { items: Array<{ productId: number }> }) =>
    fullAccess || order.items.some(item => productIds.includes(item.productId));
  return { agent, storeId: agent.storeId ?? 0, productIds, fullAccess, products, isOrderVisible };
}

export async function getCallCenterDashboard(token: string) {
  const agent = await getAgentByToken(token);
  if (!agent) throw new Error("جلسة الدخول منتهية أو غير صالحة.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const scope = await resolveCallCenterScope(token);
  const { productIds, fullAccess, products } = scope;
  const orders = await listStoreOrders(agent.storeId ?? 0);
  const visibleOrders = orders.filter(order =>
    fullAccess || order.items.some(item => productIds.includes(item.productId))
  );
  const newOrders = visibleOrders.filter(
    order => order.fulfillmentStatus === "new"
  ).length;
  const confirmedOrders = visibleOrders.filter(order =>
    ["confirmed", "processing", "at_carrier", "shipped", "delivered"].includes(
      order.fulfillmentStatus
    )
  ).length;
  const completedOrders = visibleOrders.filter(
    order => order.fulfillmentStatus === "delivered"
  ).length;
  const shippedOrders = visibleOrders.filter(order =>
    ["at_carrier", "shipped", "delivered"].includes(order.fulfillmentStatus)
  ).length;
  const cancelledOrders = visibleOrders.filter(order =>
    ["cancelled", "fake", "phone_cancelled"].includes(order.fulfillmentStatus)
  ).length;
  const compensation = calculatePerOrderCompensation(
    agent.compensationMode,
    agent.compensationMode === "completed_orders"
      ? agent.completedOrderRate
      : agent.generalOrderRate,
    confirmedOrders,
    completedOrders
  );
  const stats = {
    total: visibleOrders.length,
    new: newOrders,
    confirmed: confirmedOrders,
    completed: completedOrders,
    shipped: shippedOrders,
    cancelled: cancelledOrders,
    ...compensation,
  };
  return {
    agent: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      compensationMode: agent.compensationMode,
      rate: compensation.rate,
      unit: compensation.unit,
      fullAccess,
    },
    products,
    stats,
    orders: visibleOrders,
  };
}

function assertOrderVisible(
  order: { id: number; storeId: number | null; items: Array<{ productId: number }> },
  scope: Awaited<ReturnType<typeof resolveCallCenterScope>>
) {
  if (order.storeId !== scope.storeId) {
    throw new Error("الطلب غير موجود أو لا تملك صلاحية الوصول إليه.");
  }
  if (!scope.isOrderVisible(order)) {
    throw new Error("الطلب غير موجود أو لا تملك صلاحية الوصول إليه.");
  }
}

export async function updateCallCenterOrderStatus(
  token: string,
  orderId: number,
  fulfillmentStatus:
    | "review"
    | "confirmed"
    | "processing"
    | "at_carrier"
    | "shipped"
    | "returned"
    | "cancelled"
    | "customer_unresponsive"
    | "phone_cancelled"
    | "fake"
) {
  const scope = await resolveCallCenterScope(token);
  const orders = await listStoreOrders(scope.storeId);
  const order = orders.find(candidate => candidate.id === orderId);
  if (!order) throw new Error("الطلب غير موجود.");
  assertOrderVisible(order, scope);
  return updateStoreOrderStatus(scope.storeId, orderId, fulfillmentStatus);
}

export async function syncCallCenterOrderStatus(token: string, orderId: number) {
  const scope = await resolveCallCenterScope(token);
  const orders = await listStoreOrders(scope.storeId);
  const order = orders.find(candidate => candidate.id === orderId);
  if (!order) throw new Error("الطلب غير موجود.");
  assertOrderVisible(order, scope);
  if (!order.carrierTracking)
    throw new Error("لا يوجد رقم تتبع محفوظ لهذا الطلب.");
  const credentials = await getCarrierCredentials(
    scope.storeId,
    "ecotrack",
    order.carrierConnectionId ?? undefined
  );
  if (!credentials)
    throw new Error("حساب Ecotrack المرتبط بالطلب غير متاح أو غير مفعل.");
  try {
    const result = await getEcotrackTrackingInfo(
      credentials,
      order.carrierTracking
    );
    const mappedStatus =
      result.status === "livred" ||
      result.status === "encassed" ||
      result.status === "payed"
        ? "delivered"
        : result.status === "return_received"
          ? "returned"
          : undefined;
    const updated = await updateOrderCarrierData(scope.storeId, order.id, {
      carrierStatus: result.status ?? undefined,
      carrierStatusUpdatedAt: new Date(),
      ...(mappedStatus ? { fulfillmentStatus: mappedStatus } : {}),
    });
    return {
      success: true,
      carrierStatus: result.status,
      fulfillmentStatus: updated.fulfillmentStatus,
      updatedAt: updated.carrierStatusUpdatedAt,
    } as const;
  } catch (error) {
    if (
      error instanceof Error &&
      /404|not found|introuvable/i.test(error.message)
    ) {
      const updated = await updateOrderCarrierData(scope.storeId, order.id, {
        carrierStatus: "cancelled",
        carrierStatusUpdatedAt: new Date(),
        fulfillmentStatus: "cancelled",
      });
      return {
        success: true,
        carrierStatus: "cancelled",
        fulfillmentStatus: updated.fulfillmentStatus,
        updatedAt: updated.carrierStatusUpdatedAt,
      } as const;
    }
    throw error;
  }
}

const FINAL_ORDER_STATUSES = new Set([
  "delivered",
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
]);

export async function syncAllCallCenterOrderStatuses(token: string) {
  const scope = await resolveCallCenterScope(token);
  const orders = await listStoreOrders(scope.storeId);
  const trackedOrders = orders.filter(
    order =>
      Boolean(order.carrierTracking) &&
      !FINAL_ORDER_STATUSES.has(order.fulfillmentStatus) &&
      scope.isOrderVisible(order)
  );
  const summary = { synced: 0, delivered: 0, returned: 0, cancelled: 0 };
  const credentialsCache = new Map<
    number,
    Awaited<ReturnType<typeof getCarrierCredentials>>
  >();
  for (const order of trackedOrders) {
    const key = order.carrierConnectionId ?? -1;
    let credentials = credentialsCache.get(key);
    if (credentials === undefined) {
      credentials = await getCarrierCredentials(
        scope.storeId,
        "ecotrack",
        order.carrierConnectionId ?? undefined
      );
      credentialsCache.set(key, credentials);
    }
    if (!credentials) continue;
    try {
      const result = await getEcotrackTrackingInfo(
        credentials,
        order.carrierTracking!
      );
      const mapped =
        result.status === "livred" ||
        result.status === "encassed" ||
        result.status === "payed"
          ? "delivered"
          : result.status === "return_received"
            ? "returned"
            : undefined;
      await updateOrderCarrierData(scope.storeId, order.id, {
        carrierStatus: result.status ?? undefined,
        carrierStatusUpdatedAt: new Date(),
        ...(mapped ? { fulfillmentStatus: mapped } : {}),
      });
      summary.synced += 1;
      if (mapped === "delivered") summary.delivered += 1;
      else if (mapped === "returned") summary.returned += 1;
    } catch (error) {
      if (error instanceof Error && /404|not found|introuvable/i.test(error.message)) {
        await updateOrderCarrierData(scope.storeId, order.id, {
          carrierStatus: "cancelled",
          carrierStatusUpdatedAt: new Date(),
          fulfillmentStatus: "cancelled",
        });
        summary.cancelled += 1;
      }
    }
  }
  return summary;
}

export async function deleteCallCenterArchivedOrder(token: string, orderId: number) {
  const scope = await resolveCallCenterScope(token);
  if (!scope.fullAccess)
    throw new Error("لا تملك صلاحية حذف الطلبات. اطلب تفعيل الصلاحيات الكاملة.");
  const orders = await listStoreOrders(scope.storeId);
  const order = orders.find(candidate => candidate.id === orderId);
  if (!order) throw new Error("الطلب غير موجود.");
  assertOrderVisible(order, scope);
  if (!FINAL_ORDER_STATUSES.has(order.fulfillmentStatus))
    throw new Error("لا يمكن حذف الطلب قبل إغلاقه في الأرشيف.");
  await deleteArchivedOrder(scope.storeId, orderId);
  return { success: true };
}

export async function deleteCallCenterOrders(token: string, orderIds: number[]) {
  const scope = await resolveCallCenterScope(token);
  if (!scope.fullAccess)
    throw new Error("لا تملك صلاحية حذف الطلبات. اطلب تفعيل الصلاحيات الكاملة.");
  const orders = await listStoreOrders(scope.storeId);
  const deletable = orders.filter(
    candidate =>
      orderIds.includes(candidate.id) &&
      scope.isOrderVisible(candidate) &&
      FINAL_ORDER_STATUSES.has(candidate.fulfillmentStatus)
  );
  if (deletable.length) await deleteStoreOrdersBulk(scope.storeId, deletable.map(order => order.id));
  return { deleted: deletable.length };
}

export type CallCenterMediaContext = {
  storeId: number;
  agentId: number;
  order: {
    id: number;
    customerPhone: string;
    customerName: string;
  };
};

/** Validate an agent's right to upload/send WhatsApp media for an order.
 *  Uploading packaging media is a "full access" capability (like archive delete).
 */
export async function resolveCallCenterOrderForMedia(
  token: string,
  orderId: number
): Promise<CallCenterMediaContext> {
  const scope = await resolveCallCenterScope(token);
  if (!scope.fullAccess)
    throw new Error("لا تملك صلاحية إرسال الوسائط. اطلب تفعيل الصلاحيات الكاملة.");
  const orders = await listStoreOrders(scope.storeId);
  const order = orders.find(candidate => candidate.id === orderId);
  if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية الوصول إليه.");
  assertOrderVisible(order, scope);
  return {
    storeId: scope.storeId,
    agentId: scope.agent.id,
    order: {
      id: order.id,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
    },
  };
}

/** Send a WhatsApp media message (packaging photo/video) to the buyer. */
export async function sendCallCenterMediaToWhatsApp(
  token: string,
  orderId: number,
  mediaUrl: string,
  caption?: string
) {
  const context = await resolveCallCenterOrderForMedia(token, orderId);
  const settings = await getNotificationSettings(context.storeId);
  if (!settings?.whatsappPhoneId || !settings?.whatsappToken) {
    throw new Error("يرجى تهيئة إعدادات الإشعارات مع معلومات WhatsApp أولاً.");
  }
  let customerPhone = (context.order.customerPhone ?? "").replace(/\D/g, "");
  if (!customerPhone.startsWith("213") && customerPhone.startsWith("0")) {
    customerPhone = `213${customerPhone.substring(1)}`;
  }
  const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(mediaUrl);
  const mediaType = isVideo ? "video" : "image";
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(settings.whatsappPhoneId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: customerPhone,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          caption: caption || "",
        },
      }),
    }
  );
  const result = (await response.json()) as {
    error?: { message?: string };
    messages?: Array<{ id?: string }>;
  };
  if (!response.ok) {
    throw new Error(
      `فشل إرسال الرسالة: ${result.error?.message ?? "خطأ غير معروف"}`
    );
  }
  return {
    success: true,
    messageId: result.messages?.[0]?.id ?? null,
  };
}
