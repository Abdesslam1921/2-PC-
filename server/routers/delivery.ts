import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  deleteCarrierConnection,
  getCarrierCredentials,
  getDeliverySettings,
  getPublicStoreProduct,
  getCarrierWilayaRates,
  listCarrierConnections,
  listPublicCarrierConnectionsForProduct,
  listStoreOrders,
  saveCarrierConnection,
  saveCarrierWilayaRates,
  saveDeliverySettings,
  updateCarrierConnection,
  updateOrderCarrierData,
} from "../db";
import {
  createEcotrackOrders,
  downloadEcotrackLabel,
  extractEcotrackFailures,
  extractEcotrackTrackings,
  getEcotrackTrackingInfo,
  shipEcotrackOrder,
  toEcotrackOrder,
  validateEcotrackToken,
} from "../ecotrack";
import { storagePut } from "../storage";
import { ensureShipmentForOrder } from "../forshipDb";
import { syncStoreEcotrackStatuses } from "../ecotrackSync";
import { carrierLabelToFulfillment } from "../forshipCore";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const fee = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,2})?$/, "أدخل مبلغًا صحيحًا.")
  .nullable();
const wilayaRate = z
  .object({
    wilayaCode: z.string().trim().min(1).max(8),
    wilayaName: z.string().trim().min(2).max(120),
    officeEnabled: z.boolean(),
    officeFee: fee,
    homeEnabled: z.boolean(),
    homeFee: fee,
  })
  .superRefine((rate, context) => {
    if (!rate.officeEnabled && !rate.homeEnabled)
      context.addIssue({
        code: "custom",
        message: "فعّل التوصيل للمكتب أو للمنزل على الأقل.",
      });
    if (rate.officeEnabled && !rate.officeFee)
      context.addIssue({
        code: "custom",
        path: ["officeFee"],
        message: "أدخل سعر توصيل المكتب.",
      });
    if (rate.homeEnabled && !rate.homeFee)
      context.addIssue({
        code: "custom",
        path: ["homeFee"],
        message: "أدخل سعر توصيل المنزل.",
      });
  });

const settingsInput = z
  .object({
    fixedOfficeEnabled: z.boolean(),
    fixedOfficeFee: fee,
    fixedHomeEnabled: z.boolean(),
    fixedHomeFee: fee,
    pricingMode: z.enum(["fixed", "carrier", "manual"]).default("manual"),
    hiddenWilayaCodes: z.array(z.string().min(1).max(8)).max(69).default([]),
    customerCarrierChoiceEnabled: z.boolean().default(false),
    wilayaRates: z.array(wilayaRate).max(69),
  })
  .superRefine((settings, context) => {
    if (settings.fixedOfficeEnabled && !settings.fixedOfficeFee)
      context.addIssue({
        code: "custom",
        path: ["fixedOfficeFee"],
        message: "أدخل سعر المكتب الثابت.",
      });
    if (settings.fixedHomeEnabled && !settings.fixedHomeFee)
      context.addIssue({
        code: "custom",
        path: ["fixedHomeFee"],
        message: "أدخل سعر المنزل الثابت.",
      });
  });

export const deliveryRouter = router({
  getSettings: protectedProcedure.query(({ ctx }) =>
    getDeliverySettings(getStoreId(ctx))
  ),
  carriers: protectedProcedure.query(({ ctx }) =>
    listCarrierConnections(getStoreId(ctx))
  ),
  carrierRates: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      getCarrierWilayaRates(getStoreId(ctx), input.connectionId)
    ),
  saveCarrierRates: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int().positive(),
        rates: z.array(wilayaRate).max(69),
      })
    )
    .mutation(({ ctx, input }) =>
      saveCarrierWilayaRates(
        ctx.user.id,
        getStoreId(ctx),
        input.connectionId,
        input.rates
      )
    ),
  publicCarrierOptions: publicProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(({ input }) =>
      listPublicCarrierConnectionsForProduct(input.productId)
    ),
  connectCarrier: protectedProcedure
    .input(
      z
        .object({
          provider: z.enum(["yalidine", "zr_express", "noest", "ecotrack"]),
          accountName: z.string().trim().min(2, "اسم الحساب إجباري.").max(160),
          userGuid: z.string().trim().max(180).optional(),
          apiBaseUrl: z
            .string()
            .trim()
            .url("أدخل رابط منصة صحيحًا.")
            .optional(),
          apiToken: z.string().trim().min(8).max(500),
          pricingMode: z.enum(["manual", "carrier"]).default("manual"),
        })
        .superRefine((input, context) => {
          if (input.provider === "ecotrack" && !input.apiBaseUrl)
            context.addIssue({
              code: "custom",
              path: ["apiBaseUrl"],
              message: "أدخل رابط منصة Ecotrack.",
            });
        })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.provider === "ecotrack") {
        const accounts = await listCarrierConnections(getStoreId(ctx));
        const duplicateName = accounts.some(
          account =>
            account.provider === "ecotrack" &&
            account.accountName.toLocaleLowerCase() ===
              input.accountName.trim().toLocaleLowerCase()
        );
        if (
          !duplicateName &&
          accounts.filter(account => account.provider === "ecotrack").length >=
            10
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يمكن إضافة 10 حسابات Ecotrack فقط.",
          });
      }
      return saveCarrierConnection(ctx.user.id, getStoreId(ctx), input);
    }),
  updateEcotrackAccount: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int().positive(),
        accountName: z.string().trim().min(2, "اسم الحساب إجباري.").max(160),
        apiBaseUrl: z.string().trim().url("أدخل رابط منصة صحيحًا."),
        apiToken: z.string().trim().min(8).max(500).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      updateCarrierConnection(getStoreId(ctx), input.connectionId, input)
    ),
  deleteEcotrackAccount: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deleteCarrierConnection(getStoreId(ctx), input.connectionId)
    ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveDeliverySettings(ctx.user.id, getStoreId(ctx), input)
    ),
  quoteForProduct: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        wilaya: z.string().trim().min(2),
        wilayaCode: z
          .string()
          .trim()
          .regex(/^(0[1-9]|[1-4][0-9]|5[0-8])$/)
          .optional(),
        deliveryMethod: z.enum(["office", "home"]),
      })
    )
    .query(async ({ input }) => {
      const product = await getPublicStoreProduct(input.productId);
      if (!product?.storeId) return { deliveryFee: "0.00", configured: false };
      // Product-level free delivery overrides every rate source.
      if (product.freeDelivery)
        return { deliveryFee: "0.00", configured: true, free: true };
      const settings = await getDeliverySettings(product.storeId);
      const rate = settings.wilayaRates.find(
        item =>
          (input.wilayaCode && item.wilayaCode === input.wilayaCode) ||
          item.wilayaName === input.wilaya
      );
      const configuredFee =
        input.deliveryMethod === "office"
          ? rate?.officeEnabled
            ? rate.officeFee
            : null
          : rate?.homeEnabled
            ? rate.homeFee
            : null;
      const fixedFee =
        input.deliveryMethod === "office"
          ? settings.settings.fixedOfficeEnabled
            ? settings.settings.fixedOfficeFee
            : null
          : settings.settings.fixedHomeEnabled
            ? settings.settings.fixedHomeFee
            : null;
      const fee =
        configuredFee && Number(configuredFee) > 0
          ? configuredFee
          : fixedFee && Number(fixedFee) > 0
            ? fixedFee
            : null;
      return { deliveryFee: fee ?? "0.00", configured: Boolean(fee) };
    }),
  testEcotrack: protectedProcedure.mutation(async ({ ctx }) => {
    const credentials = await getCarrierCredentials(
      getStoreId(ctx),
      "ecotrack"
    );
    if (!credentials)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "اربط Ecotrack أولًا.",
      });
    try {
      return await validateEcotrackToken(credentials);
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "تعذر التحقق من توكن Ecotrack.",
      });
    }
  }),
  bulkUploadEcotrack: protectedProcedure
    .input(
      z.object({
        orderIds: z.array(z.number().int().positive()).min(1).max(100),
        connectionId: z.number().int().positive().optional(),
        bureauByOrder: z
          .record(z.string(), z.string().trim().min(2).max(160))
          .default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orders = await listStoreOrders(getStoreId(ctx));
      const selected = orders.filter(order =>
        input.orderIds.includes(order.id)
      );
      if (selected.length !== input.orderIds.length)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "بعض الطلبات غير موجودة أو لا تملك صلاحية إرسالها.",
        });
      type SelectedOrder = (typeof selected)[number];
      const groups = new Map<number, SelectedOrder[]>();
      const failed: Array<{
        orderId?: number;
        orderNumber: string;
        error: string;
      }> = [];
      for (const order of selected) {
        const connectionId =
          input.connectionId ?? order.carrierConnectionId ?? undefined;
        const officeCommune =
          order.deliveryMethod === "office"
            ? input.bureauByOrder[String(order.id)] ||
              order.carrierMunicipality ||
              undefined
            : undefined;
        if (!connectionId) {
          failed.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: "لا يوجد حساب Ecotrack محفوظ مع هذا الطلب.",
          });
          continue;
        }
        if (order.deliveryMethod === "office" && !officeCommune) {
          failed.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: `لم يُحفظ مكتب Stop Desk للطلب ${order.orderNumber}.`,
          });
          continue;
        }
        if (
          order.deliveryMethod === "home" &&
          !order.carrierMunicipality &&
          !order.municipality
        ) {
          failed.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: `طلب التوصيل للمنزل ${order.orderNumber} لا يحتوي على بلدية.`,
          });
          continue;
        }
        const group = groups.get(connectionId) ?? [];
        group.push(order);
        groups.set(connectionId, group);
      }
      const allTrackings: Array<{ reference: string; tracking: string }> = [];
      const responses: unknown[] = [];
      try {
        for (const [connectionId, group] of Array.from(groups.entries())) {
          const credentials = await getCarrierCredentials(
            getStoreId(ctx),
            "ecotrack",
            connectionId
          );
          if (!credentials) {
            group.forEach((order: SelectedOrder) =>
              failed.push({
                orderId: order.id,
                orderNumber: order.orderNumber,
                error: "حساب Ecotrack المحفوظ غير مربوط أو غير صالح.",
              })
            );
            continue;
          }
          const valid = group.map((order: SelectedOrder) => ({
            order,
            payload: toEcotrackOrder(
              order,
              order.items,
              order.deliveryMethod === "office"
                ? input.bureauByOrder[String(order.id)] ||
                    order.carrierMunicipality ||
                    undefined
                : undefined
            ),
          }));
          const result = await createEcotrackOrders(
            credentials,
            valid.map(
              (item: {
                order: SelectedOrder;
                payload: ReturnType<typeof toEcotrackOrder>;
              }) => item.payload
            )
          );
          responses.push(result.payload);
          const trackings = extractEcotrackTrackings(result.payload);
          const rejected = extractEcotrackFailures(result.payload);
          allTrackings.push(...trackings);
          failed.push(
            ...rejected.map((item: { reference: string; message: string }) => ({
              orderNumber: item.reference,
              error: item.message,
            }))
          );
          await Promise.all(
            trackings.map((item: { reference: string; tracking: string }) => {
              const order = group.find(
                (candidate: SelectedOrder) =>
                  candidate.orderNumber === item.reference
              );
              return order
                ? updateOrderCarrierData(getStoreId(ctx), order.id, {
                    carrierTracking: item.tracking,
                    carrierConnectionId: connectionId,
                    fulfillmentStatus: "at_carrier",
                  }).then(() =>
                    ensureShipmentForOrder(getStoreId(ctx), order.id)
                  )
                : Promise.resolve();
            })
          );
        }
        return {
          success: allTrackings.length === selected.length,
          submitted: selected.length,
          tracked: allTrackings.length,
          failed,
          response: responses.length === 1 ? responses[0] : responses,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "تعذر رفع الطلبات إلى Ecotrack.",
        });
      }
    }),
  shipOrderToEcotrack: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        tracking: z.string().trim().min(4).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credentials = await getCarrierCredentials(
        getStoreId(ctx),
        "ecotrack"
      );
      if (!credentials)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "اربط Ecotrack أولًا.",
        });
      try {
        const result = await shipEcotrackOrder(credentials, input.tracking);
        await updateOrderCarrierData(getStoreId(ctx), input.orderId, {
          carrierTracking: input.tracking,
        });
        await ensureShipmentForOrder(getStoreId(ctx), input.orderId);
        return { success: true, response: result.payload };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "تعذر شحن الطلب.",
        });
      }
    }),
  syncEcotrackStatus: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const order = (await listStoreOrders(getStoreId(ctx))).find(
        candidate => candidate.id === input.orderId
      );
      if (!order)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الطلب غير موجود أو لا تملك صلاحية الوصول إليه.",
        });
      if (!order.carrierTracking)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "لا يوجد رقم تتبع محفوظ لهذا الطلب.",
        });
      const credentials = await getCarrierCredentials(
        getStoreId(ctx),
        "ecotrack",
        order.carrierConnectionId ?? undefined
      );
      if (!credentials)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "حساب Ecotrack المرتبط بالطلب غير متاح أو غير مفعل.",
        });
      try {
        const result = await getEcotrackTrackingInfo(
          credentials,
          order.carrierTracking
        );
        const mappedStatus = carrierLabelToFulfillment(result.status);
        // Hybrid rule: apply the carrier's state only when it differs.
        const nextFulfillment =
          mappedStatus && mappedStatus !== order.fulfillmentStatus
            ? mappedStatus
            : undefined;
        const updated = await updateOrderCarrierData(
          getStoreId(ctx),
          order.id,
          {
            carrierStatus: result.status ?? undefined,
            carrierStatusUpdatedAt: new Date(),
            ...(nextFulfillment
              ? { fulfillmentStatus: nextFulfillment }
              : {}),
          }
        );
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
          const updated = await updateOrderCarrierData(
            getStoreId(ctx),
            order.id,
            {
              carrierStatus: "cancelled",
              carrierStatusUpdatedAt: new Date(),
              fulfillmentStatus: "cancelled",
            }
          );
          return {
            success: true,
            carrierStatus: "cancelled",
            fulfillmentStatus: updated.fulfillmentStatus,
            updatedAt: updated.carrierStatusUpdatedAt,
          } as const;
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "تعذر مزامنة حالة الطلب من Ecotrack.",
        });
      }
    }),
  syncAllEcotrackStatuses: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await syncStoreEcotrackStatuses(getStoreId(ctx));
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "تعذر قراءة بيانات اعتماد Ecotrack.",
      });
    }
  }),
  createShippingLabel: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        tracking: z.string().trim().min(4).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credentials = await getCarrierCredentials(
        getStoreId(ctx),
        "ecotrack"
      );
      if (!credentials)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "اربط Ecotrack أولًا.",
        });
      try {
        const pdf = await downloadEcotrackLabel(credentials, input.tracking);
        const uploaded = await storagePut(
          `shipping-labels/${ctx.user.id}/${input.tracking}.pdf`,
          pdf,
          "application/pdf"
        );
        await updateOrderCarrierData(getStoreId(ctx), input.orderId, {
          carrierTracking: input.tracking,
          shippingLabelUrl: uploaded.url,
        });
        await ensureShipmentForOrder(getStoreId(ctx), input.orderId);
        return { success: true, url: uploaded.url };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "تعذر تنزيل بوليصة الشحن.",
        });
      }
    }),
  uploadMedia: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        file: z.any(), // This will be handled by middleware for file uploads
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate order exists
      const orders = await listStoreOrders(getStoreId(ctx));
      const order = orders.find(ord => ord.id === input.orderId);
      
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الطلب غير موجود أو لا تملك صلاحية الوصول إليه.",
        });
      }

      // Process file upload using storagePut
      // In a real implementation, this would receive the raw file data
      // For now, I'll simulate the upload process
      const fileExtension = input.fileName.split('.').pop()?.toLowerCase() || 'bin';
      const storageKey = `whatsapp-media/${getStoreId(ctx)}/order-${input.orderId}/${Date.now()}.${fileExtension}`;
      
      // In a real implementation, we would get the raw file bytes from the input
      // and pass them to storagePut. For now, we'll just return the storage URL
      const result = await storagePut(storageKey, Buffer.from(""), "application/octet-stream");
      
      return {
        success: true,
        url: result.url,
        storageKey: result.key,
      };
    }),

  sendMediaToWhatsApp: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        mediaUrl: z.string().url(),
        caption: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get order details to retrieve customer phone
      const orders = await listStoreOrders(getStoreId(ctx));
      const order = orders.find(ord => ord.id === input.orderId);
      
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الطلب غير موجود أو لا تملك صلاحية الوصول إليه.",
        });
      }

      // Get notification settings to get WhatsApp credentials
      const { getNotificationSettings } = await import("../db");
      const settings = await getNotificationSettings(getStoreId(ctx));
      
      if (!settings?.whatsappPhoneId || !settings?.whatsappToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "يرجى تهيئة إعدادات الإشعارات مع معلومات WhatsApp أولاً.",
        });
      }

      // Format customer phone number for WhatsApp
      let customerPhone = order.customerPhone.replace(/\D/g, ""); // Remove non-digit characters
      if (!customerPhone.startsWith("213") && customerPhone.startsWith("0")) {
        // Convert Algerian numbers from 0x to 213x format
        customerPhone = `213${customerPhone.substring(1)}`;
      }

      // Determine media type based on URL extension
      const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(input.mediaUrl);
      const mediaType = isVideo ? "video" : "image";

      // Send media message via WhatsApp Cloud API
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
              link: input.mediaUrl,
              caption: input.caption || ""
            }
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        console.error("WhatsApp API Error:", result);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `فشل إرسال الرسالة: ${result.error?.message || 'خطأ غير معروف'}`
        });
      }

      return {
        success: true,
        messageId: result.messages?.[0]?.id || null
      };
    }),

});
