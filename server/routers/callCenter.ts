import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCallCenterAgent,
  createCallCenterAgentSession,
  deleteCallCenterAgent,
  deleteCallCenterArchivedOrder,
  deleteCallCenterOrders,
  getCallCenterDashboard,
  listCallCenterAgents,
  loginCallCenterAgent,
  sendCallCenterMediaToWhatsApp,
  syncAllCallCenterOrderStatuses,
  syncCallCenterOrderStatus,
  updateCallCenterAgent,
  updateCallCenterOrderStatus,
} from "../callCenterDb";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const productIds = z.array(z.number().int().positive()).max(100);
const rate = z.string().regex(/^\d{1,9}(?:\.\d{1,2})?$/, "أدخل سعرًا صحيحًا.");
const agentFields = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().regex(/.*@gmail\.com$/).max(320),
  enabled: z.boolean(),
  notifyNewOrders: z.boolean().default(true),
  notifyStatusChanges: z.boolean().default(true),
  notifyCancelledOrders: z.boolean().default(true),
  notifyUnresponsiveOrders: z.boolean().default(true),
  notifyFollowUp: z.boolean().default(true),
  compensationMode: z
    .enum(["all_orders", "completed_orders"])
    .default("all_orders"),
  generalOrderRate: rate.default("0.00"),
  completedOrderRate: rate.default("0.00"),
  productIds,
});

export const callCenterRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    listCallCenterAgents(getStoreId(ctx))
  ),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().regex(/.*@gmail\.com$/).max(320),
        password: z.string().min(8).max(128),
        notifyNewOrders: z.boolean().default(true),
        notifyStatusChanges: z.boolean().default(true),
        notifyCancelledOrders: z.boolean().default(true),
        notifyUnresponsiveOrders: z.boolean().default(true),
        notifyFollowUp: z.boolean().default(true),
        compensationMode: z
          .enum(["all_orders", "completed_orders"])
          .default("all_orders"),
        generalOrderRate: rate.default("0.00"),
        completedOrderRate: rate.default("0.00"),
        productIds,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCallCenterAgent(ctx.user.id, getStoreId(ctx), input);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر إنشاء الحساب.",
        });
      }
    }),
  update: protectedProcedure
    .input(
      agentFields.extend({
        agentId: z.number().int().positive(),
        password: z.string().min(8).max(128).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      updateCallCenterAgent(getStoreId(ctx), input.agentId, input)
    ),
  remove: protectedProcedure
    .input(z.object({ agentId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deleteCallCenterAgent(getStoreId(ctx), input.agentId)
    ),
  impersonate: protectedProcedure
    .input(z.object({ agentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCallCenterAgentSession(
          getStoreId(ctx),
          input.agentId
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "تعذر الدخول إلى حساب العميل.",
        });
      }
    }),
  login: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await loginCallCenterAgent(input);
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            error instanceof Error ? error.message : "تعذر تسجيل الدخول.",
        });
      }
    }),
  dashboard: publicProcedure
    .input(z.object({ token: z.string().trim().min(32).max(128) }))
    .query(async ({ input }) => {
      try {
        return await getCallCenterDashboard(input.token);
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            error instanceof Error ? error.message : "جلسة الدخول غير صالحة.",
        });
      }
    }),
  updateOrderStatus: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(32).max(128),
        orderId: z.number().int().positive(),
        fulfillmentStatus: z.enum([
          "review",
          "confirmed",
          "processing",
          "at_carrier",
          "shipped",
          "returned",
          "cancelled",
          "customer_unresponsive",
          "phone_cancelled",
          "fake",
        ]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await updateCallCenterOrderStatus(
          input.token,
          input.orderId,
          input.fulfillmentStatus
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر تحديث حالة الطلب.",
        });
      }
    }),
  syncOrderStatus: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(32).max(128),
        orderId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await syncCallCenterOrderStatus(input.token, input.orderId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر مزامنة حالة الطلب.",
        });
      }
    }),
  syncAllOrderStatuses: publicProcedure
    .input(z.object({ token: z.string().trim().min(32).max(128) }))
    .mutation(async ({ input }) => {
      try {
        return await syncAllCallCenterOrderStatuses(input.token);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "تعذر مزامنة حالات الشحن.",
        });
      }
    }),
  deleteArchivedOrder: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(32).max(128),
        orderId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await deleteCallCenterArchivedOrder(input.token, input.orderId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر حذف الطلب.",
        });
      }
    }),
  deleteOrders: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(32).max(128),
        orderIds: z.array(z.number().int().positive()).max(100),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await deleteCallCenterOrders(input.token, input.orderIds);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر حذف الطلبات.",
        });
      }
    }),
  sendMediaToWhatsApp: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(32).max(128),
        orderId: z.number().int().positive(),
        mediaUrl: z.string().min(1).max(1000),
        caption: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await sendCallCenterMediaToWhatsApp(
          input.token,
          input.orderId,
          input.mediaUrl,
          input.caption
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر إرسال الملف إلى واتساب.",
        });
      }
    }),
});
