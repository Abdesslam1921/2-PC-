import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCodOrder,
  createManualOrder,
  getOfferDetails,
  deleteArchivedOrder,
  deleteStoreOrder,
  deleteStoreOrdersBulk,
  evaluateOrderClean,
  getDb,
  getPublicSharkCodSettings,
  getPublicStoreProduct,
  getTodayWilayaOrderCount,
  listStoreOrders,
  recordOrderCleanEvent,
  recordSharkCodEvent,
  setOrderConfirmationAttribution,
  updateStoreOrder,
  updateStoreOrderStatus,
  upsertAbandonedOrder,
} from "../db";
import { storeOrderItems, storeOrders } from "../../drizzle/schema";
import { notifyNewOrder } from "../notifications";
import { notifyCallCenterAgents } from "../callCenterNotifications";
import { verifyTurnstile } from "../turnstile";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const lineInput = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  offerId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(50),
  priceOverride: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .optional(),
});

const checkoutInput = z.object({
  customerName: z.string().trim().min(2, "أدخل الاسم الكامل.").max(180),
  customerPhone: z
    .string()
    .trim()
    .regex(
      /^0[567][0-9]{8}$/,
      "رقم الهاتف يجب أن يبدأ بـ05 أو 06 أو 07 ويتكون من 10 أرقام."
    ),
  wilaya: z.string().trim().min(2, "اختر الولاية.").max(120),
  wilayaCode: z
    .string()
    .trim()
    .regex(
      /^(0[1-9]|[1-4][0-9]|5[0-8])$/,
      "رمز الولاية يجب أن يكون بين 01 و58."
    )
    .optional(),
  municipality: z.string().trim().min(2, "اختر البلدية.").max(160).optional(),
  carrierMunicipality: z.string().trim().min(2).max(160).optional(),
  carrierConnectionId: z.number().int().positive().optional(),
  deliveryMethod: z.enum(["office", "home"]).default("home"),
  address: z.string().trim().min(5, "أدخل العنوان بالتفصيل.").max(2000),
  notes: z.string().trim().max(1000).optional(),
  landingPageId: z.number().int().positive().optional(),
  sharkCodDiscountPercent: z.number().int().min(0).max(90).optional(),
  retargetDiscountPercent: z.number().int().min(0).max(90).optional(),
  lines: z.array(lineInput).min(1, "السلة فارغة.").max(20),
  /**
   * Bundles applied in the cart (id + how many times). Prices and discounts are
   * recomputed server-side from the DB — the client never sends amounts.
   */
  appliedOffers: z
    .array(
      z.object({
        offerId: z.number().int().positive(),
        times: z.number().int().min(1).max(10).default(1),
      })
    )
    .max(5)
    .optional(),
  sessionId: z.string().trim().max(128).optional(),
  turnstileToken: z.string().trim().max(4096).optional(),
  attributionSource: z.string().trim().max(80).optional(),
  fbclid: z.string().trim().max(255).optional(),
  utmSource: z.string().trim().max(160).optional(),
  utmMedium: z.string().trim().max(160).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
  utmContent: z.string().trim().max(255).optional(),
  utmTerm: z.string().trim().max(255).optional(),
  metaCampaignId: z.string().trim().max(80).optional(),
  metaAdSetId: z.string().trim().max(80).optional(),
  metaAdId: z.string().trim().max(80).optional(),
});

export const ordersRouter = router({
  createCod: publicProcedure
    .input(checkoutInput)
    .mutation(async ({ input }) => {
      const merged = new Map<
        string,
        {
          productId: number;
          variantId?: number;
          offerId?: number;
          quantity: number;
        }
      >();
      for (const line of input.lines) {
        const key = `${line.productId}-${line.variantId ?? "base"}-${line.offerId ?? "base"}`;
        const current = merged.get(key);
        const quantity = current
          ? current.quantity + line.quantity
          : line.quantity;
        if (quantity > 50)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن طلب أكثر من 50 وحدة من المنتج نفسه.",
          });
        merged.set(key, current ? { ...current, quantity } : line);
      }
      try {
        const product = await getPublicStoreProduct(input.lines[0].productId);
        const storeId = product?.storeId ?? null;
        if (
          product &&
          storeId != null &&
          !(await verifyTurnstile(storeId, input.turnstileToken))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "تعذر التحقق من الحماية. أعد المحاولة.",
          });
        const clean =
          product && storeId != null
            ? await evaluateOrderClean(storeId, input.customerPhone, product.id)
            : undefined;
        if (clean?.verdict === "blocked") {
          void recordOrderCleanEvent({
            ownerId: product!.ownerId,
            storeId: clean.storeId,
            productId: clean.productId,
            phoneHash: clean.phoneHash,
            verdict: clean.verdict,
            reason: clean.reason,
          });
          throw new TRPCError({
            code: "CONFLICT",
            message: `تم إيقاف الطلب لحمايتك من التكرار. ${clean.reason}`,
          });
        }
        /**
         * Bundles: availability and quantities are re-checked against the DB.
         * Any mismatch rejects the whole order with a clear message — the
         * discount is never silently dropped or changed.
         */
        const lines = Array.from(merged.values());
        const bundles: Array<{
          offerId: number;
          name: string;
          discountAmount: string;
          freeDelivery: boolean;
          times: number;
        }> = [];
        if (input.appliedOffers?.length && storeId != null) {
          for (const applied of input.appliedOffers) {
            const details = await getOfferDetails(storeId, applied.offerId);
            if (!details) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "أحد العروض في سلتك لم يعد موجودًا.",
              });
            }
            if (details.unavailableReason) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `تعذّر تطبيق العرض «${details.offer.name}»: ${details.unavailableReason}`,
              });
            }
            for (const item of details.items) {
              const needed = item.quantity * applied.times;
              const have = lines
                .filter(line => line.productId === item.productId)
                .reduce((sum, line) => sum + line.quantity, 0);
              if (have < needed) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `كمية «${item.title}» في السلة أقل من المطلوب للعرض «${details.offer.name}».`,
                });
              }
            }
            bundles.push({
              offerId: applied.offerId,
              name: details.offer.name,
              discountAmount: details.pricing.discountAmount.toFixed(2),
              freeDelivery: details.pricing.freeDelivery,
              times: applied.times,
            });
          }
        }
        const result = await createCodOrder(input, lines, bundles);
        if (clean?.verdict === "review")
          await updateStoreOrderStatus(clean.storeId, result.id, "review");
        if (clean?.settingsId)
          void recordOrderCleanEvent({
            ownerId: product!.ownerId,
            storeId: clean.storeId,
            productId: clean.productId,
            orderId: result.id,
            phoneHash: clean.phoneHash,
            verdict: clean.verdict,
            reason: clean.reason,
          });
        if (product && result.sharkCodDiscountPercent > 0) {
          void getPublicSharkCodSettings(product.id, input.landingPageId).then(
            settings =>
              settings
                ? recordSharkCodEvent({
                    ownerId: settings.ownerId,
                    storeId: settings.storeId,
                    settingsId: settings.id,
                    eventType: "discount_order",
                    productId: product.id,
                    landingPageId: input.landingPageId,
                    orderId: result.id,
                    sessionId: input.sessionId,
                  })
                : undefined
          );
        }
        if (product) {
          const orderNotification = {
            orderNumber: result.orderNumber,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            total: result.total,
            wilaya: input.wilaya,
            deliveryMethod: input.deliveryMethod,
            fulfillmentStatus: clean?.verdict === "review" ? "review" : "new",
          };
          void notifyNewOrder(storeId ?? 0, orderNotification);
          void notifyCallCenterAgents(
            storeId ?? 0,
            Array.from(new Set(input.lines.map(line => line.productId))),
            "new_order",
            orderNotification
          );
        }
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "تعذر إنشاء الطلب.",
        });
      }
    }),
  list: protectedProcedure.query(async ({ ctx }) =>
    listStoreOrders(getStoreId(ctx))
  ),
  deleteArchived: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteArchivedOrder(getStoreId(ctx), input.orderId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر حذف الطلب المؤرشف.",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteStoreOrder(getStoreId(ctx), input.orderId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "تعذر حذف الطلب.",
        });
      }
    }),
  deleteMany: protectedProcedure
    .input(
      z.object({ orderIds: z.array(z.number().int().positive()).max(500) })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteStoreOrdersBulk(getStoreId(ctx), input.orderIds);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "تعذر حذف الطلبات.",
        });
      }
    }),
  saveAbandoned: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        landingPageId: z.number().int().positive().optional(),
        sessionId: z.string().trim().min(8).max(128),
        customerName: z.string().trim().max(180).optional(),
        customerPhone: z.string().trim().max(40).optional(),
        wilaya: z.string().trim().max(120).optional(),
        municipality: z.string().trim().max(160).optional(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .mutation(async ({ input }) => upsertAbandonedOrder(input)),
  createManual: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(50).default(1),
        customerName: z.string().trim().min(2).max(180),
        customerPhone: z
          .string()
          .trim()
          .regex(/^0[567][0-9]{8}$/),
        wilaya: z.string().trim().min(2).max(120),
        municipality: z.string().trim().max(160).optional(),
        address: z.string().trim().max(2000).optional(),
        fulfillmentStatus: z
          .enum(["new", "confirmed", "abandoned"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      createManualOrder(getStoreId(ctx), input)
    ),
  setConfirmationAttribution: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        source: z.enum(["owner", "call_center"]),
        agentId: z.number().int().positive().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      setOrderConfirmationAttribution(
        getStoreId(ctx),
        input.orderId,
        input.source,
        input.agentId
      )
    ),
  updateStatus: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        fulfillmentStatus: z.enum([
          "new",
          "review",
          "confirmed",
          "processing",
          "at_carrier",
          "shipped",
          "delivered",
          "returned",
          "cancelled",
          "customer_unresponsive",
          "phone_cancelled",
          "fake",
          "abandoned",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateStoreOrderStatus(
          getStoreId(ctx),
          input.orderId,
          input.fulfillmentStatus
        );
        const orders = await listStoreOrders(getStoreId(ctx));
        const order = orders.find(candidate => candidate.id === input.orderId);
        if (order?.items?.length) {
          const orderNotification = {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: order.total,
            wilaya: order.wilaya,
            deliveryMethod: order.deliveryMethod,
            fulfillmentStatus: updated.fulfillmentStatus,
          };
          const productIds = order.items.map(item => item.productId);
          const statusEvent = ["cancelled"].includes(updated.fulfillmentStatus)
            ? "cancelled"
            : ["customer_unresponsive", "phone_cancelled", "fake"].includes(
                  updated.fulfillmentStatus
                )
              ? "unresponsive"
              : "status_change";
          void notifyCallCenterAgents(
            getStoreId(ctx),
            productIds,
            statusEvent,
            orderNotification
          );
          if (
            ["at_carrier", "shipped", "delivered", "returned"].includes(
              updated.fulfillmentStatus
            )
          )
            void notifyCallCenterAgents(
              getStoreId(ctx),
              productIds,
              "follow_up",
              orderNotification
            );
        }
        return updated;
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            error instanceof Error ? error.message : "تعذر تحديث حالة الطلب.",
        });
      }
    }),
  getById: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const storeId = getStoreId(ctx);
      const db = await getDb();
      if (!db) return null;
      const [order] = await db
        .select()
        .from(storeOrders)
        .where(
          and(
            eq(storeOrders.id, input.orderId),
            eq(storeOrders.storeId, storeId)
          )
        )
        .limit(1);
      if (!order) return null;
      const items = await db
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, order.id));
      return { ...order, items } as typeof order & {
        items: typeof items;
      };
    }),
  getTodayWilayaOrderCount: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        wilaya: z.string().trim().min(1).max(120),
      })
    )
    .query(async ({ input }) => ({
      count: await getTodayWilayaOrderCount(input.productId, input.wilaya),
    })),
  update: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        customerName: z.string().trim().min(2).max(180).optional(),
        customerPhone: z
          .string()
          .trim()
          .regex(/^0[567][0-9]{8}$/)
          .optional(),
        customerEmail: z.string().trim().max(320).optional().default(""),
        wilaya: z.string().trim().min(2).max(120).optional(),
        wilayaCode: z.string().trim().max(3).optional().default(""),
        municipality: z.string().trim().max(160).optional().default(""),
        carrierMunicipality: z.string().trim().max(160).optional().default(""),
        deliveryMethod: z.enum(["office", "home"]).optional(),
        address: z.string().trim().min(5).max(2000).optional(),
        notes: z.string().trim().max(1000).optional().default(""),
        fulfillmentStatus: z
          .enum([
            "new",
            "review",
            "confirmed",
            "processing",
            "at_carrier",
            "shipped",
            "delivered",
            "returned",
            "cancelled",
            "customer_unresponsive",
            "phone_cancelled",
            "fake",
            "abandoned",
          ])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orderId, ...data } = input;
      const storeId = getStoreId(ctx);
      return updateStoreOrder(storeId, orderId, data);
    }),
});
