import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createStoreProduct,
  deleteStoreProduct,
  duplicateStoreProduct,
  getPublicStoreProduct,
  getStoreProductById,
  listPublicStoreProducts,
  listStoreProducts,
  updateStoreProduct,
} from "../db";
import { storagePut } from "../storage";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const moneyInput = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .optional()
  .or(z.literal(""));
const mediaInput = z.object({
  id: z.string().min(1).max(180),
  fileName: z.string().min(1).max(255),
  dataUrl: z.string().min(30).max(6_000_000),
});
const offerInput = z.object({
  description: z.string().trim().min(2).max(500),
  quantity: z.number().int().min(1).max(1_000_000),
  price: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/),
  maxUses: z.number().int().min(0).max(1_000_000),
  freeDelivery: z.boolean(),
  enabled: z.boolean(),
});
const digitalFileInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  dataUrl: z.string().min(40).max(70_000_000),
  mimeType: z.string().trim().max(160).optional(),
  size: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .optional(),
});
const variantInput = z.object({
  color: z.string().trim().max(120).optional(),
  size: z.string().trim().max(120).optional(),
  sku: z.string().trim().max(128).optional(),
  price: moneyInput,
  compareAtPrice: moneyInput,
  stock: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  showStockThreshold: z.number().int().min(0).max(1_000_000),
  mediaId: z.string().optional(),
  available: z.boolean(),
});
const costBatchInput = z.object({
  quantity: z.number().int().min(1).max(1_000_000),
  productCostTotal: moneyInput.default("0.00"),
  packagingCostTotal: moneyInput.default("0.00"),
  procurementDeliveryCostTotal: moneyInput.default("0.00"),
  receivedAt: z.string().max(32).optional(),
});

const productInput = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(12_000).default(""),
  productType: z.string().trim().max(160).optional(),
  productKind: z.enum(["physical", "digital"]).default("physical"),
  currency: z.string().trim().min(3).max(8).default("DZD"),
  collectionName: z.string().trim().max(160).optional(),
  status: z.enum(["draft", "active"]),
  price: moneyInput,
  compareAtPrice: moneyInput,
  costPerItem: moneyInput,
  costAccountingMode: z.enum(["per_item", "stock_total"]).default("per_item"),
  costQuantity: z.number().int().min(1).max(1_000_000).default(1),
  productCostTotal: moneyInput.default("0.00"),
  packagingCostPerItem: moneyInput.default("0.00"),
  packagingCostTotal: moneyInput.default("0.00"),
  procurementDeliveryCostPerItem: moneyInput.default("0.00"),
  procurementDeliveryCostTotal: moneyInput.default("0.00"),
  returnCostPerOrder: moneyInput.default("0.00"),
  returnDeliveryFree: z.boolean().default(false),
  costBatches: z.array(costBatchInput).max(100).default([]),
  sku: z.string().trim().max(128).optional(),
  inventory: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  showStockThreshold: z.number().int().min(0).max(1_000_000),
  trackInventory: z.boolean(),
  continueSelling: z.boolean(),
  deliveryPricingMode: z.enum(["fixed", "carrier", "manual"]).default("manual"),
  deliveryCarrierConnectionId: z.number().int().positive().optional(),
  media: z.array(mediaInput).max(12),
  variants: z.array(variantInput).max(100),
  offers: z.array(offerInput).max(30).default([]),
  digitalFile: digitalFileInput.optional(),
  digitalMaxDownloads: z.number().int().min(1).max(1000).optional(),
  digitalLinkValidityHours: z.number().int().min(1).max(8760).optional(),
  upsellProductId: z.number().int().positive().nullable().optional(),
  upsellPrice: moneyInput.nullable(),
  upsellDiscountAmount: moneyInput.nullable(),
  upsellDiscountPercent: z.number().int().min(0).max(99).nullable().optional(),
  upsellViewType: z.enum(["product", "landing"]).optional(),
  upsellLandingPageId: z.number().int().positive().nullable().optional(),
  codTrustScore: z.string().trim().max(255).optional(),
});
const productIdInput = z.object({ id: z.number().int().positive() });

function emptyToNull(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function decodeImage(dataUrl: string) {
  const matched = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );
  if (!matched)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "صيغة صورة غير مدعومة.",
    });
  const contentType = matched[1];
  const buffer = Buffer.from(matched[2], "base64");
  if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "يجب ألا يتجاوز حجم الصورة 4 ميغابايت.",
    });
  return { contentType, buffer };
}

function decodeDigitalFile(file: z.infer<typeof digitalFileInput>) {
  const matched = file.dataUrl.match(
    /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!matched)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "تعذر قراءة الملف الرقمي.",
    });
  const extension = file.fileName.toLowerCase().split(".").pop() ?? "";
  const allowedExtensions = new Set([
    "pdf",
    "zip",
    "epub",
    "csv",
    "json",
    "txt",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "psd",
    "ai",
    "sketch",
    "fig",
    "figma",
    "ase",
    "abr",
    "tpl",
    "preset",
    "exe",
    "dmg",
    "msi",
  ]);
  if (!allowedExtensions.has(extension))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "نوع الملف الرقمي غير مدعوم. الأنواع المتاحة تشمل PDF وZIP وEPUB والقوالب وملفات التصميم والبرامج.",
    });
  const buffer = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > 50 * 1024 * 1024)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "يجب ألا يتجاوز الملف الرقمي 50 ميغابايت.",
    });
  return { buffer, contentType: matched[1], extension, size: buffer.length };
}

function toStoredProductInput(
  input: z.infer<typeof productInput>,
  digital?: {
    fileName: string;
    storageKey: string;
    url: string;
    size: number;
    mimeType: string;
  }
) {
  return {
    title: input.title,
    description: input.description,
    productType: emptyToNull(input.productType),
    productKind: input.productKind,
    currency: input.currency.toUpperCase(),
    collectionName: emptyToNull(input.collectionName),
    digitalFileName: digital?.fileName ?? null,
    digitalFileStorageKey: digital?.storageKey ?? null,
    digitalFileUrl: digital?.url ?? null,
    digitalFileSize: digital?.size ?? null,
    digitalFileMimeType: digital?.mimeType ?? null,
    digitalMaxDownloads:
      input.productKind === "digital" ? (input.digitalMaxDownloads ?? 5) : null,
    digitalLinkValidityHours:
      input.productKind === "digital"
        ? (input.digitalLinkValidityHours ?? 72)
        : null,
    status: input.status,
    price: emptyToNull(input.price),
    compareAtPrice: emptyToNull(input.compareAtPrice),
    costPerItem: emptyToNull(input.costPerItem),
    costAccountingMode: input.costAccountingMode,
    costQuantity: input.costQuantity,
    productCostTotal: emptyToNull(input.productCostTotal) ?? "0.00",
    packagingCostPerItem: emptyToNull(input.packagingCostPerItem) ?? "0.00",
    packagingCostTotal: emptyToNull(input.packagingCostTotal) ?? "0.00",
    procurementDeliveryCostPerItem:
      emptyToNull(input.procurementDeliveryCostPerItem) ?? "0.00",
    procurementDeliveryCostTotal:
      emptyToNull(input.procurementDeliveryCostTotal) ?? "0.00",
    returnCostPerOrder: emptyToNull(input.returnCostPerOrder) ?? "0.00",
    returnDeliveryFree: input.returnDeliveryFree,
    costBatches: JSON.stringify(input.costBatches),
    sku: emptyToNull(input.sku),
    inventory: input.inventory,
    lowStockThreshold: input.lowStockThreshold,
    showStockThreshold: input.showStockThreshold,
    trackInventory:
      input.productKind === "digital" ? false : input.trackInventory,
    continueSelling:
      input.productKind === "digital" ? true : input.continueSelling,
    deliveryPricingMode:
      input.productKind === "digital"
        ? ("fixed" as const)
        : input.deliveryPricingMode,
    deliveryCarrierConnectionId:
      input.productKind === "digital"
        ? null
        : (input.deliveryCarrierConnectionId ?? null),
    upsellProductId:
      input.productKind === "digital" ? null : (input.upsellProductId ?? null),
    upsellPrice: emptyToNull(input.upsellPrice),
    upsellDiscountAmount: emptyToNull(input.upsellDiscountAmount),
    upsellDiscountPercent: input.upsellDiscountPercent ?? null,
    upsellViewType:
      input.productKind === "digital" || !input.upsellProductId
        ? "product"
        : (input.upsellViewType ?? "product"),
    upsellLandingPageId:
      input.productKind === "digital" ||
      !input.upsellProductId ||
      input.upsellViewType !== "landing"
        ? null
        : (input.upsellLandingPageId ?? null),
    codTrustScore: input.codTrustScore?.trim() || null,
  };
}

export const productsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    listStoreProducts(getStoreId(ctx))
  ),
  get: protectedProcedure
    .input(productIdInput)
    .query(async ({ ctx, input }) => {
      const product = await getStoreProductById(getStoreId(ctx), input.id);
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المنتج غير موجود.",
        });
      return product;
    }),
  publicGet: publicProcedure.input(productIdInput).query(async ({ input }) => {
    const product = await getPublicStoreProduct(input.id);
    if (!product)
      throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير متاح." });
    return product;
  }),
  publicList: publicProcedure.query(async ({ ctx }) =>
    listPublicStoreProducts(ctx.store?.id)
  ),
  create: protectedProcedure
    .input(productInput)
    .mutation(async ({ ctx, input }) => {
      if (input.productKind === "digital" && !input.digitalFile)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "أرفق الملف الرقمي قبل حفظ المنتج.",
        });
      let digital:
        | {
            fileName: string;
            storageKey: string;
            url: string;
            size: number;
            mimeType: string;
          }
        | undefined;
      if (input.productKind === "digital" && input.digitalFile) {
        const decoded = decodeDigitalFile(input.digitalFile);
        const stored = await storagePut(
          `digital-products/${ctx.user.id}/${Date.now()}-${input.digitalFile.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
          decoded.buffer,
          decoded.contentType
        );
        digital = {
          fileName: input.digitalFile.fileName,
          storageKey: stored.key,
          url: stored.url,
          size: decoded.size,
          mimeType: decoded.contentType,
        };
      }
      const media = await Promise.all(
        input.media.map(async (item, position) => {
          const { buffer, contentType } = decodeImage(item.dataUrl);
          const extension =
            contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
          const { key, url } = await storagePut(
            `products/${ctx.user.id}/${Date.now()}-${position}.${extension}`,
            buffer,
            contentType
          );
          return {
            clientId: item.id,
            storageKey: key,
            url,
            altText: input.title,
            position,
          };
        })
      );
      return createStoreProduct(ctx.user.id, getStoreId(ctx), {
        ...toStoredProductInput(input, digital),
        media,
        variants:
          input.productKind === "digital"
            ? []
            : input.variants.map(variant => ({
                ...variant,
                color: emptyToNull(variant.color),
                size: emptyToNull(variant.size),
                sku: emptyToNull(variant.sku),
                price: emptyToNull(variant.price),
                compareAtPrice: emptyToNull(variant.compareAtPrice),
              })),
        offers:
          input.productKind === "digital"
            ? []
            : input.offers.map(offer => ({
                ...offer,
                description: offer.description.trim(),
              })),
        imageIdByClientId: new Map(),
      });
    }),
  update: protectedProcedure
    .input(
      productIdInput.extend({
        title: productInput.shape.title,
        description: productInput.shape.description,
        productType: productInput.shape.productType,
        productKind: productInput.shape.productKind,
        currency: productInput.shape.currency,
        collectionName: productInput.shape.collectionName,
        status: productInput.shape.status,
        price: productInput.shape.price,
        compareAtPrice: productInput.shape.compareAtPrice,
        costPerItem: productInput.shape.costPerItem,
        costAccountingMode: productInput.shape.costAccountingMode,
        costQuantity: productInput.shape.costQuantity,
        productCostTotal: productInput.shape.productCostTotal,
        packagingCostPerItem: productInput.shape.packagingCostPerItem,
        packagingCostTotal: productInput.shape.packagingCostTotal,
        procurementDeliveryCostPerItem:
          productInput.shape.procurementDeliveryCostPerItem,
        procurementDeliveryCostTotal:
          productInput.shape.procurementDeliveryCostTotal,
        returnCostPerOrder: productInput.shape.returnCostPerOrder,
        returnDeliveryFree: productInput.shape.returnDeliveryFree,
        costBatches: productInput.shape.costBatches,
        sku: productInput.shape.sku,
        inventory: productInput.shape.inventory,
        lowStockThreshold: productInput.shape.lowStockThreshold,
        showStockThreshold: productInput.shape.showStockThreshold,
        trackInventory: productInput.shape.trackInventory,
        continueSelling: productInput.shape.continueSelling,
        deliveryPricingMode: productInput.shape.deliveryPricingMode,
        deliveryCarrierConnectionId:
          productInput.shape.deliveryCarrierConnectionId,
        offers: productInput.shape.offers,
        digitalMaxDownloads: productInput.shape.digitalMaxDownloads,
        digitalLinkValidityHours: productInput.shape.digitalLinkValidityHours,
        upsellProductId: productInput.shape.upsellProductId,
        upsellPrice: productInput.shape.upsellPrice,
        upsellDiscountAmount: productInput.shape.upsellDiscountAmount,
        upsellDiscountPercent: productInput.shape.upsellDiscountPercent,
        upsellViewType: productInput.shape.upsellViewType,
        upsellLandingPageId: productInput.shape.upsellLandingPageId,
        codTrustScore: productInput.shape.codTrustScore,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...payload } = input;
      return updateStoreProduct(getStoreId(ctx), id, {
        ...payload,
        productType: emptyToNull(payload.productType),
        collectionName: emptyToNull(payload.collectionName),
        productKind: payload.productKind,
        currency: payload.currency.toUpperCase(),
        price: emptyToNull(payload.price),
        compareAtPrice: emptyToNull(payload.compareAtPrice),
        costPerItem: emptyToNull(payload.costPerItem),
        costAccountingMode: payload.costAccountingMode,
        costQuantity: payload.costQuantity,
        productCostTotal: emptyToNull(payload.productCostTotal) ?? "0.00",
        packagingCostPerItem:
          emptyToNull(payload.packagingCostPerItem) ?? "0.00",
        packagingCostTotal: emptyToNull(payload.packagingCostTotal) ?? "0.00",
        procurementDeliveryCostPerItem:
          emptyToNull(payload.procurementDeliveryCostPerItem) ?? "0.00",
        procurementDeliveryCostTotal:
          emptyToNull(payload.procurementDeliveryCostTotal) ?? "0.00",
        returnCostPerOrder: emptyToNull(payload.returnCostPerOrder) ?? "0.00",
        returnDeliveryFree: payload.returnDeliveryFree,
        costBatches: JSON.stringify(payload.costBatches),
        sku: emptyToNull(payload.sku),
        deliveryCarrierConnectionId:
          payload.deliveryPricingMode === "carrier"
            ? (payload.deliveryCarrierConnectionId ?? null)
            : null,
        upsellProductId:
          payload.productKind === "digital"
            ? null
            : (payload.upsellProductId ?? null),
        upsellPrice: emptyToNull(payload.upsellPrice),
        upsellDiscountAmount: emptyToNull(payload.upsellDiscountAmount),
        upsellDiscountPercent: payload.upsellDiscountPercent ?? null,
        upsellViewType:
          payload.productKind === "digital" || !payload.upsellProductId
            ? "product"
            : (payload.upsellViewType ?? "product"),
        upsellLandingPageId:
          payload.productKind === "digital" ||
          !payload.upsellProductId ||
          payload.upsellViewType !== "landing"
            ? null
            : (payload.upsellLandingPageId ?? null),
        codTrustScore: payload.codTrustScore?.trim() || null,
        offers: payload.offers.map(offer => ({
          ...offer,
          description: offer.description.trim(),
        })),
      });
    }),
  duplicate: protectedProcedure
    .input(productIdInput)
    .mutation(async ({ ctx, input }) =>
      duplicateStoreProduct(getStoreId(ctx), input.id)
    ),
  delete: protectedProcedure
    .input(productIdInput)
    .mutation(async ({ ctx, input }) =>
      deleteStoreProduct(getStoreId(ctx), input.id)
    ),
});
