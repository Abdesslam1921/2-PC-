import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createOffer,
  deleteOffer,
  getOfferDetails,
  listOffersWithDetails,
  listPublicOffers,
  getPublicOfferBySlug,
  setOfferOrder,
  setOfferProducts,
  setProductUpsell,
  sumProductsPrice,
  updateOffer,
} from "../db";

/** URL-safe slug, Arabic-friendly (same rule as categories). */
function isSlugChar(ch: string) {
  if (/[A-Za-z0-9]/.test(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

function slugify(value: string) {
  const cleaned = value.trim().replace(/[\s_]+/g, "-");
  let out = "";
  for (const ch of cleaned) {
    if (ch === "-") out += "-";
    else if (isSlugChar(ch)) out += /[A-Za-z]/.test(ch) ? ch.toLowerCase() : ch;
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function isValidSlug(value: string) {
  if (!value) return false;
  for (const ch of value) if (ch !== "-" && !isSlugChar(ch)) return false;
  return true;
}

const offerBody = z.object({
  /** "bundle" (default) = several products + discount, "quantity" = legacy deal. */
  kind: z.enum(["bundle", "quantity"]).optional(),
  name: z.string().trim().min(1, "اسم العرض مطلوب.").max(160),
  slug: z
    .string()
    .trim()
    .max(160)
    .refine(isValidSlug, "المعرّف يقبل حروفًا وأرقامًا وشرطات فقط.")
    .optional(),
  imageUrl: z.string().trim().max(1024).optional().or(z.literal("")),
  /** null = no discount (bundle price = the products' sum). */
  discountType: z.enum(["percent", "amount"]).nullable().optional(),
  discountValue: z.number().min(0).max(1_000_000).nullable().optional(),
  /** Quantity deals only: the product, its quantity and the fixed total price. */
  productId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  fixedPrice: z.number().min(0).max(1_000_000).optional(),
  maxUses: z.number().int().min(0).max(100_000).optional(),
  freeDelivery: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const itemsInput = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(99).default(1),
    })
  )
  .max(20);

/**
 * Quantity tiers: the legacy form created SEVERAL tiers for one product at once
 * ("1 piece at X, 2 pieces at Y, ..."), so the API accepts them in one call.
 */
const tiersInput = z
  .array(
    z.object({
      quantity: z.number().int().min(1).max(99),
      price: z.number().min(0).max(1_000_000),
      description: z.string().trim().max(160).optional(),
      maxUses: z.number().int().min(0).max(100_000).optional(),
      freeDelivery: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .min(1)
  .max(20);

/** The active store of the caller, or a hard failure (never cross-tenant). */
function requireStoreId(ctx: { store?: { id: number } | null }): number {
  const storeId = ctx.store?.id ?? null;
  if (storeId == null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "لا يوجد متجر مرتبط بحسابك.",
    });
  }
  return storeId;
}

/** Shared discount validation (percent ≤ 95, fixed amount > 0). */
function validateDiscount(
  discountType: "percent" | "amount" | null | undefined,
  discountValue: number | null | undefined
) {
  if (discountType == null) return;
  const value = discountValue ?? 0;
  if (discountType === "percent") {
    if (value <= 0 || value > 95) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "نسبة الخصم يجب أن تكون بين 1 و95%.",
      });
    }
    return;
  }
  if (value <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "قيمة الخصم يجب أن تكون أكبر من صفر.",
    });
  }
}

export const offersRouter = router({
  /** Dashboard list: offers + items + pricing + why an offer is hidden. */
  list: protectedProcedure.query(async ({ ctx }) =>
    listOffersWithDetails(requireStoreId(ctx))
  ),

  create: protectedProcedure
    .input(
      offerBody.extend({
        items: itemsInput.optional(),
        /** One call can create several tiers of the same product. */
        tiers: tiersInput.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const kind = input.kind ?? "bundle";
      validateDiscount(input.discountType, input.discountValue);

      // Quantity deal (legacy): one product with ONE OR SEVERAL tiers
      // ("1 piece at X, 2 pieces at Y, ...") created together.
      if (kind === "quantity") {
        const tiers =
          input.tiers ??
          (input.quantity && input.fixedPrice != null
            ? [
                {
                  quantity: input.quantity,
                  price: input.fixedPrice,
                  description: input.name,
                  maxUses: input.maxUses,
                  freeDelivery: input.freeDelivery,
                  isActive: input.isActive,
                },
              ]
            : []);
        if (!input.productId || !tiers.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "عرض الكمية يحتاج منتجًا وطبقة واحدة على الأقل.",
          });
        }
        const unitPrice = await sumProductsPrice(storeId, [
          { productId: input.productId, quantity: 1 },
        ]);
        if (unitPrice <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "المنتج غير موجود في متجرك.",
          });
        }
        const ids: number[] = [];
        for (const tier of tiers) {
          if (tier.price <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "سعر كل طبقة يجب أن يكون أكبر من صفر.",
            });
          }
          const sum = unitPrice * tier.quantity;
          // Same price is allowed; only a HIGHER price is rejected.
          if (tier.price > sum) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `سعر طبقة ${tier.quantity} قطع (${tier.price}) أعلى من السعر العادي (${sum}).`,
            });
          }
          const id = await createOffer({
            ownerId: ctx.user.id,
            storeId,
            kind: "quantity",
            name: (tier.description?.trim() || input.name).trim(),
            // Quantity deals have no public page: a deterministic unique slug
            // only satisfies the (storeId, slug) constraint.
            slug: `q-${storeId}-${Date.now().toString(36)}-${tier.quantity}`,
            fixedPrice: tier.price.toFixed(2),
            maxUses: tier.maxUses ?? 0,
            freeDelivery: tier.freeDelivery ?? input.freeDelivery,
            isActive: tier.isActive ?? input.isActive,
          });
          await setOfferProducts({
            storeId,
            offerId: id,
            items: [{ productId: input.productId, quantity: tier.quantity }],
          });
          ids.push(id);
        }
        return { id: ids[0], ids, slug: `q-${ids[0]}` };
      }

      const slug = slugify(input.slug?.trim() || input.name);
      if (!slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "تعذّر توليد معرّف للعرض، اكتبه يدويًا.",
        });
      }
      let id: number;
      try {
        id = await createOffer({
          ownerId: ctx.user.id,
          storeId,
          kind: "bundle",
          name: input.name.trim(),
          slug,
          imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
          discountType: input.discountType ?? null,
          discountValue:
            input.discountValue != null ? input.discountValue.toFixed(2) : null,
          freeDelivery: input.freeDelivery,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        });
      } catch (error) {
        if (String(error).includes("Duplicate")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا المعرّف مستعمل من قبل، اختر معرّفًا آخر.",
          });
        }
        throw error;
      }
      if (input.items?.length) {
        await setOfferProducts({ storeId, offerId: id, items: input.items });
      }
      return { id, slug };
    }),

  update: protectedProcedure
    .input(
      offerBody
        .partial()
        .extend({ id: z.number().int().positive(), items: itemsInput.optional() })
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const existing = await getOfferDetails(storeId, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العرض غير موجود." });
      }
      if (input.discountType !== undefined || input.discountValue !== undefined) {
        validateDiscount(
          input.discountType ?? existing.offer.discountType,
          input.discountValue ?? Number(existing.offer.discountValue ?? 0)
        );
      }
      // A fixed amount must stay below the products' sum, otherwise the bundle
      // would have no valid price (the storefront hides such an offer).
      const type = input.discountType ?? existing.offer.discountType;
      const value = input.discountValue ?? Number(existing.offer.discountValue ?? 0);
      if (type === "amount" && existing.items.length) {
        const sum = existing.items.reduce(
          (total, item) => total + Number(item.price ?? 0) * item.quantity,
          0
        );
        if (value >= sum) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "قيمة الخصم تساوي أو تتجاوز مجموع أسعار المنتجات — نقّص الخصم أو ارفع الأسعار.",
          });
        }
      }

      const patch: Parameters<typeof updateOffer>[0]["patch"] = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.slug !== undefined) {
        const slug = slugify(input.slug);
        if (!slug) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "معرّف العرض غير صالح.",
          });
        }
        patch.slug = slug;
      }
      if (input.imageUrl !== undefined) {
        patch.imageUrl = input.imageUrl?.trim() ? input.imageUrl.trim() : null;
      }
      if (input.discountType !== undefined) patch.discountType = input.discountType;
      if (input.discountValue !== undefined) {
        patch.discountValue =
          input.discountValue != null ? input.discountValue.toFixed(2) : null;
      }
      if (input.freeDelivery !== undefined) patch.freeDelivery = input.freeDelivery;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      // Quantity deals: fixed price + usage limit are editable like the legacy
      // form allowed, and the single product/quantity can be swapped here.
      if (input.fixedPrice !== undefined) {
        if (input.fixedPrice != null && input.fixedPrice <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "سعر عرض الكمية يجب أن يكون أكبر من صفر.",
          });
        }
        patch.fixedPrice =
          input.fixedPrice != null ? input.fixedPrice.toFixed(2) : null;
      }
      if (input.maxUses !== undefined) patch.maxUses = input.maxUses;
      try {
        if (Object.keys(patch).length) {
          await updateOffer({ storeId, id: input.id, patch });
        }
      } catch (error) {
        if (String(error).includes("Duplicate")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا المعرّف مستعمل من قبل، اختر معرّفًا آخر.",
          });
        }
        throw error;
      }
      // Quantity deal: the single product (and its quantity) can be changed.
      if (existing.offer.kind === "quantity") {
        if (input.productId !== undefined || input.quantity !== undefined) {
          const productId =
            input.productId ?? existing.items[0]?.productId ?? null;
          const quantity = input.quantity ?? existing.items[0]?.quantity ?? 1;
          if (!productId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "عرض الكمية يحتاج منتجًا.",
            });
          }
          await setOfferProducts({
            storeId,
            offerId: input.id,
            items: [{ productId, quantity }],
          });
        }
      } else if (input.items) {
        await setOfferProducts({ storeId, offerId: input.id, items: input.items });
      } else if (input.productId !== undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "الباقة تُعدّل من أداة إدارة المنتجات (⚙).",
        });
      }
      return { ok: true };
    }),

  /** Deletion is direct: offers hold no data other orders depend on. */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const existing = await getOfferDetails(storeId, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العرض غير موجود." });
      }
      await deleteOffer(storeId, input.id);
      return { ok: true };
    }),

  /** Replace the products (and quantities) of an offer. */
  setProducts: protectedProcedure
    .input(z.object({ offerId: z.number().int().positive(), items: itemsInput }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const existing = await getOfferDetails(storeId, input.offerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العرض غير موجود." });
      }
      // A quantity deal is a single product by definition.
      if (existing.offer.kind === "quantity" && input.items.length !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "عرض الكمية يحتاج منتجًا واحدًا فقط.",
        });
      }
      // A fixed amount must stay below the NEW products' sum.
      if (existing.offer.discountType === "amount" && input.items.length) {
        const sum = await sumProductsPrice(storeId, input.items);
        const value = Number(existing.offer.discountValue ?? 0);
        if (value >= sum) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "قيمة الخصم تساوي أو تتجاوز مجموع أسعار المنتجات — نقّص الخصم أو غيّر المنتجات.",
          });
        }
      }
      await setOfferProducts({
        storeId,
        offerId: input.offerId,
        items: input.items,
      });
      return { ok: true };
    }),

  /**
   * Upsell bridge: writes the product's upsell columns (the popup, the order
   * pricing and the landing page stay untouched). Passing null clears it.
   */
  setUpsell: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        upsellProductId: z.number().int().positive().nullable(),
        upsellPrice: z.number().min(0).max(1_000_000).nullable().optional(),
        upsellDiscountAmount: z
          .number()
          .min(0)
          .max(1_000_000)
          .nullable()
          .optional(),
        upsellDiscountPercent: z.number().int().min(0).max(95).nullable().optional(),
        upsellViewType: z.enum(["product", "landing"]).nullable().optional(),
        upsellLandingPageId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const owned = await sumProductsPrice(storeId, [
        { productId: input.productId, quantity: 1 },
      ]);
      if (owned <= 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المنتج غير موجود في متجرك.",
        });
      }
      if (input.upsellProductId != null) {
        const upsellOwned = await sumProductsPrice(storeId, [
          { productId: input.upsellProductId, quantity: 1 },
        ]);
        if (upsellOwned <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "منتج العرض التكميلي غير موجود في متجرك.",
          });
        }
      }
      await setProductUpsell({
        storeId,
        productId: input.productId,
        patch: {
          upsellProductId: input.upsellProductId,
          upsellPrice:
            input.upsellProductId != null && input.upsellPrice != null
              ? input.upsellPrice.toFixed(2)
              : null,
          upsellDiscountAmount:
            input.upsellProductId != null && input.upsellDiscountAmount != null
              ? input.upsellDiscountAmount.toFixed(2)
              : null,
          upsellDiscountPercent:
            input.upsellProductId != null
              ? (input.upsellDiscountPercent ?? null)
              : null,
          ...(input.upsellProductId != null
            ? { upsellViewType: input.upsellViewType ?? "product" }
            : {}),
          upsellLandingPageId:
            input.upsellProductId != null && input.upsellViewType === "landing"
              ? (input.upsellLandingPageId ?? null)
              : null,
        },
      });
      return { ok: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      await setOfferOrder(storeId, input.ids);
      return { ok: true };
    }),

  /**
   * Public list for the storefront. Fail-closed: no resolved store → empty,
   * and only offers that are active AND fully available are returned.
   */
  publicList: publicProcedure.query(async ({ ctx }) =>
    ctx.store ? listPublicOffers(ctx.store.id) : []
  ),

  /** Public offer by slug (fail-closed NOT_FOUND like products/categories). */
  publicGet: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(160) }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.store?.id ?? null;
      if (storeId == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العرض غير متاح." });
      }
      const offer = await getPublicOfferBySlug(input.slug, storeId);
      if (!offer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العرض غير متاح." });
      }
      return offer;
    }),
});
