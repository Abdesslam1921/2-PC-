import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  countCategoryProducts,
  createCategory,
  deleteCategory,
  getCategoryById,
  getPublicCategoryBySlug,
  listCategoriesWithCounts,
  listPublicCategories,
  listPublicProductsByCategory,
  setCategoryOrder,
  setCategoryProducts,
  updateCategory,
} from "../db";

/**
 * Slug characters: Latin/digits plus Arabic letters and Arabic-Indic digits.
 * Written without Unicode property escapes so it works on the project's TS
 * target (no `u` flag / `\p{...}` support there).
 */
function isSlugChar(ch: string) {
  if (/[A-Za-z0-9]/.test(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x0600 && code <= 0x06ff) || // Arabic
    (code >= 0x0750 && code <= 0x077f) || // Arabic supplement
    (code >= 0x08a0 && code <= 0x08ff) || // Arabic extended-A
    (code >= 0xfb50 && code <= 0xfdff) || // Arabic presentation forms-A
    (code >= 0xfe70 && code <= 0xfeff) // Arabic presentation forms-B
  );
}

/** URL-safe slug, Arabic-friendly (letters/digits/dashes). */
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
  for (const ch of value) {
    if (ch !== "-" && !isSlugChar(ch)) return false;
  }
  return true;
}

const slugInput = z
  .string()
  .trim()
  .max(160)
  .refine(isValidSlug, "المعرّف يقبل حروفًا وأرقامًا وشرطات فقط.");

const categoryBody = z.object({
  name: z.string().trim().min(1, "اسم الفئة مطلوب.").max(160),
  slug: slugInput.optional(),
  imageUrl: z.string().trim().max(1024).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

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

export const categoriesRouter = router({
  /** Dashboard list: categories of the active store + how many products each has. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const storeId = requireStoreId(ctx);
    return listCategoriesWithCounts(storeId);
  }),

  create: protectedProcedure.input(categoryBody).mutation(async ({ ctx, input }) => {
    const storeId = requireStoreId(ctx);
    const slug = slugify(input.slug?.trim() || input.name);
    if (!slug) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "تعذّر توليد معرّف للفئة، اكتبه يدويًا.",
      });
    }
    try {
      const id = await createCategory({
        ownerId: ctx.user.id,
        storeId,
        name: input.name.trim(),
        slug,
        imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      });
      return { id, slug };
    } catch (error) {
      if (String(error).includes("Duplicate")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "هذا المعرّف مستعمل من قبل، اختر معرّفًا آخر.",
        });
      }
      throw error;
    }
  }),

  update: protectedProcedure
    .input(categoryBody.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const existing = await getCategoryById(storeId, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير موجودة." });
      }
      const patch: Parameters<typeof updateCategory>[0]["patch"] = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.slug !== undefined) {
        const slug = slugify(input.slug);
        if (!slug) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "معرّف الفئة غير صالح.",
          });
        }
        patch.slug = slug;
      }
      if (input.imageUrl !== undefined) {
        patch.imageUrl = input.imageUrl?.trim() ? input.imageUrl.trim() : null;
      }
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      try {
        await updateCategory({ storeId, id: input.id, patch });
      } catch (error) {
        if (String(error).includes("Duplicate")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا المعرّف مستعمل من قبل، اختر معرّفًا آخر.",
          });
        }
        throw error;
      }
      return { ok: true };
    }),

  /**
   * Deletion is blocked while products are still linked, so a category can
   * never silently orphan products. The merchant must unlink them first.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const existing = await getCategoryById(storeId, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير موجودة." });
      }
      const linked = await countCategoryProducts(storeId, input.id);
      if (linked > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `لا يمكن حذف الفئة: ${linked} منتج مرتبط بها. افصل المنتجات أولًا.`,
        });
      }
      await deleteCategory(storeId, input.id);
      return { ok: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      await setCategoryOrder(storeId, input.ids);
      return { ok: true };
    }),

  /**
   * Bulk (un)assign products of the caller's store to one category. Products
   * are always resolved through the store, so ids from other tenants are
   * ignored instead of being moved.
   */
  setProducts: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        productIds: z.array(z.number().int().positive()).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = requireStoreId(ctx);
      const category = await getCategoryById(storeId, input.categoryId);
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير موجودة." });
      }
      await setCategoryProducts({
        storeId,
        categoryId: input.categoryId,
        productIds: input.productIds,
      });
      return { ok: true };
    }),

  /**
   * Public list for the storefront. Fail-closed: without a resolved store the
   * answer is an empty list (never every store's categories).
   */
  publicList: publicProcedure.query(async ({ ctx }) =>
    ctx.store ? listPublicCategories(ctx.store.id) : []
  ),

  /**
   * Public category page data. Fail-closed like `products.publicGet`: no
   * resolved store or an unknown/inactive slug both answer NOT_FOUND.
   */
  publicGet: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(160) }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.store?.id ?? null;
      if (storeId == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير متاحة." });
      }
      const category = await getPublicCategoryBySlug(input.slug, storeId);
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير متاحة." });
      }
      const products = await listPublicProductsByCategory(category.id, storeId);
      return {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          imageUrl: category.imageUrl,
        },
        products,
      };
    }),
});
