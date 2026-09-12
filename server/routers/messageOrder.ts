import { z } from "zod";
import {
  createMessageOrder,
  getMessageOrderSettings,
  getPublicMessageOrderSettings,
  listMessageOrders,
  saveMessageOrderSettings,
  updateMessageOrderStatus,
} from "../db";
import { notifyNewOrder } from "../notifications";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const settingsInput = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(2).max(180),
  welcomeMessage: z.string().trim().max(2000),
  instructions: z.string().trim().max(2000),
  buttonText: z.string().trim().min(2).max(180),
});

const messageOrderInput = z.object({
  customerName: z.string().trim().min(2, "أدخل الاسم الكامل.").max(180),
  customerPhone: z
    .string()
    .trim()
    .regex(
      /^0[567][0-9]{8}$/,
      "رقم الهاتف يجب أن يبدأ بـ05 أو 06 أو 07 ويتكون من 10 أرقام."
    ),
  wilaya: z.string().trim().min(2, "اختر الولاية.").max(120),
  wilayaCode: z.string().trim().max(3).optional(),
  municipality: z.string().trim().max(160).optional(),
  address: z.string().trim().min(5, "أدخل العنوان بالتفصيل.").max(2000),
  message: z.string().trim().min(5, "اكتب رسالة الطلب.").max(4000),
  productId: z.number().int().positive().optional(),
});

export const messageOrderRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getMessageOrderSettings(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveMessageOrderSettings(ctx.user.id, getStoreId(ctx), input)
    ),
  publicForProduct: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) => getPublicMessageOrderSettings(input.productId)),
  submit: publicProcedure
    .input(messageOrderInput)
    .mutation(async ({ input }) => {
      if (!input.productId) {
        throw new Error("تعذر تحديد المتجر.");
      }
      const settings = await getPublicMessageOrderSettings(input.productId);
      if (!settings?.enabled) {
        throw new Error("هذه الخدمة غير مفعّلة حالياً.");
      }
      const order = await createMessageOrder({
        ownerId: settings.ownerId,
        storeId: settings.storeId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        wilaya: input.wilaya,
        wilayaCode: input.wilayaCode,
        municipality: input.municipality,
        address: input.address,
        message: input.message,
      });
      void notifyNewOrder(settings.storeId, {
        orderNumber: String(order.id),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        total: "0.00",
        wilaya: input.wilaya,
        deliveryMethod: "home",
      });
      return { success: true, id: order.id } as const;
    }),
  list: protectedProcedure.query(({ ctx }) =>
    listMessageOrders(getStoreId(ctx))
  ),
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "review", "converted", "archived"]) }))
    .mutation(({ ctx, input }) =>
      updateMessageOrderStatus(getStoreId(ctx), input.id, input.status)
    ),
});
