import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ensureShipmentForOrder,
  listCarriers,
  listStoreShipments,
} from "../forshipDb";
import {
  manualRefreshShipment,
  registerCarrierWebhook,
  runAdaptivePolling,
} from "../forship";
import { ENV } from "../_core/env";
import { getStoreId, protectedProcedure, router } from "../_core/trpc";

export const forshipRouter = router({
  shipments: protectedProcedure.query(({ ctx }) =>
    listStoreShipments(getStoreId(ctx))
  ),
  carriers: protectedProcedure.query(() => listCarriers()),
  refresh: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = getStoreId(ctx);
      await ensureShipmentForOrder(storeId, input.orderId);
      const shipments = await listStoreShipments(storeId);
      if (!shipments.some(shipment => shipment.orderId === input.orderId))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الطلب غير موجود أو لا يحتوي على رقم تتبع.",
        });
      try {
        return await manualRefreshShipment(input.orderId);
      } catch (error) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            error instanceof Error ? error.message : "تعذر المزامنة اليدوية.",
        });
      }
    }),
  registerWebhook: protectedProcedure
    .input(z.object({ carrierId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const store = ctx.store;
      if (!store)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "المتجر غير متاح. أنشئ متجرًا أولًا.",
        });
      const carriers = await listCarriers();
      const carrier = carriers.find(item => item.id === input.carrierId);
      if (!carrier)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "شركة التوصيل غير موجودة.",
        });
      if (!ENV.forshipCallbackUrl)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "رابط الاستقبال غير مهيأ. عيّن FORSHIP_CALLBACK_URL.",
        });
      try {
        return await registerCarrierWebhook(
          store.ownerId,
          input.carrierId,
          `${ENV.forshipCallbackUrl.replace(/\/+$/, "")}/api/webhooks/carrier/${input.carrierId}`
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر تسجيل الـWebhook.",
        });
      }
    }),
  syncNow: protectedProcedure.mutation(async () => runAdaptivePolling(500)),
});
