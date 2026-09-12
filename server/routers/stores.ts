import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  landingPages,
  storeOrders,
  storeProducts,
  stores,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { verifyPassword } from "../_core/auth";
import { getSessionCookieOptions } from "../_core/cookies";
import { invokeLLM } from "../_core/llm";
import { ACTIVE_STORE_COOKIE, listStoresForOwner } from "../_core/stores";
import { protectedProcedure, router } from "../_core/trpc";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "الرابط يجب أن يبدأ وينتهي بحرف أو رقم، ويحتوي فقط على أحرف إنجليزية وأرقام وشرطات."
  );

export const storesRouter = router({
  active: protectedProcedure.query(({ ctx }) => ctx.store),

  listMine: protectedProcedure.query(({ ctx }) =>
    listStoresForOwner(ctx.user.id)
  ),

  checkSlugAvailability: protectedProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: true } as const;
      const [existing] = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.slug, input.slug))
        .limit(1);
      return { available: !existing } as const;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "اسم المتجر مطلوب.").max(160),
        slug: slugSchema,
        language: z.string().trim().min(2).max(16).default("dz-ar"),
        templateId: z.string().trim().max(80).optional(),
        aiStyleConfig: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "قاعدة البيانات غير متاحة حاليًا.",
        });

      const [existing] = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.slug, input.slug))
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "هذا الرابط مستخدم بالفعل.",
        });

      const [created] = await db.insert(stores).values({
        ownerId: ctx.user.id,
        name: input.name.trim(),
        slug: input.slug,
        language: input.language,
        templateId: input.templateId ?? null,
        aiStyleConfig: input.aiStyleConfig
          ? JSON.stringify(input.aiStyleConfig)
          : null,
        isActive: true,
      });

      const id = Number(created?.insertId);
      if (!id)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "تعذر إنشاء المتجر.",
        });

      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);
      if (!store)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "تعذر تحميل المتجر.",
        });

      return store;
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mine = await listStoresForOwner(ctx.user.id);
      const store = mine.find(item => item.id === input.id);
      if (!store)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المتجر غير موجود.",
        });
      ctx.res.cookie(ACTIVE_STORE_COOKIE, String(store.id), {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
      return store;
    }),

  generateAiTemplate: protectedProcedure
    .input(
      z.object({
        storeType: z.string().trim().min(2).max(200),
        favoriteColor: z.string().trim().min(2).max(60),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "أنت مصمم هوية بصرية لمتاجر إلكترونية. أعد استجابة JSON فقط بالحقول: primaryColor, accentColor, fontFamily, style, description.",
          },
          {
            role: "user",
            content: `نوع المتجر: ${input.storeType}\nاللون المفضل: ${input.favoriteColor}\nاقترح لوحة ألوان وخطًا ونمطًا بصريًا مناسبًا.`,
          },
        ],
        responseFormat: { type: "json_object" },
      });

      const content = result.choices[0]?.message?.content ?? "{}";
      const text =
        typeof content === "string"
          ? content
          : content
              .map(part => (part.type === "text" ? part.text : ""))
              .join("");
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }

      return {
        primaryColor:
          typeof parsed.primaryColor === "string"
            ? parsed.primaryColor
            : "#6D5CE7",
        accentColor:
          typeof parsed.accentColor === "string"
            ? parsed.accentColor
            : "#F4B84A",
        fontFamily:
          typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Cairo",
        style: typeof parsed.style === "string" ? parsed.style : "modern",
        description:
          typeof parsed.description === "string" ? parsed.description : "",
      };
    }),

  generateFromPrompt: protectedProcedure
    .input(
      z.object({
        prompt: z
          .string()
          .trim()
          .min(12, "صف متجرك في 12 حرفًا على الأقل.")
          .max(1600),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "أنت مصمم هوية بصرية لمتاجر إلكترونية. أعد استجابة JSON فقط بالحقول: name, primaryColor, accentColor, fontFamily, style, description, templateKey. اختر ألوانًا وخطًا ونمطًا يناسب وصف المتجر. لا تخترع منتجات أو أرقام مبيعات.",
          },
          {
            role: "user",
            content: `صمم هوية بصرية لمتجر بناءً على هذا الوصف:\n${input.prompt}`,
          },
        ],
        responseFormat: { type: "json_object" },
      });
      const content = result.choices[0]?.message?.content ?? "{}";
      const text =
        typeof content === "string"
          ? content
          : content
              .map(part => (part.type === "text" ? part.text : ""))
              .join("");
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }
      return {
        name: typeof parsed.name === "string" ? parsed.name : null,
        primaryColor:
          typeof parsed.primaryColor === "string"
            ? parsed.primaryColor
            : "#6D5CE7",
        accentColor:
          typeof parsed.accentColor === "string"
            ? parsed.accentColor
            : "#F4B84A",
        fontFamily:
          typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Cairo",
        style: typeof parsed.style === "string" ? parsed.style : "modern",
        description:
          typeof parsed.description === "string" ? parsed.description : "",
        templateKey:
          typeof parsed.templateKey === "string" ? parsed.templateKey : null,
      };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        password: z.string().trim().min(1, "أدخل كلمة المرور."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "قاعدة البيانات غير متاحة حاليًا.",
        });
      if (!ctx.user.passwordHash)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "حسابك غير مفعّل بكلمة مرور، لا يمكن تأكيد الحذف.",
        });
      const passwordValid = await verifyPassword(
        input.password,
        ctx.user.passwordHash
      );
      if (!passwordValid)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "كلمة المرور غير صحيحة.",
        });
      const mine = await listStoresForOwner(ctx.user.id);
      if (mine.length <= 1)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن حذف آخر متجر. أنشئ متجرًا آخر أولًا.",
        });
      const store = mine.find(item => item.id === input.id);
      if (!store)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المتجر غير موجود.",
        });
      const [hasProducts] = await db
        .select({ id: storeProducts.id })
        .from(storeProducts)
        .where(eq(storeProducts.storeId, input.id))
        .limit(1);
      const [hasOrders] = await db
        .select({ id: storeOrders.id })
        .from(storeOrders)
        .where(eq(storeOrders.storeId, input.id))
        .limit(1);
      const [hasLandings] = await db
        .select({ id: landingPages.id })
        .from(landingPages)
        .where(eq(landingPages.storeId, input.id))
        .limit(1);
      if (hasProducts || hasOrders || hasLandings)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "لا يمكن حذف المتجر لأنه يحتوي على منتجات أو طلبات أو صفحات هبوط. احذفها أولًا.",
        });
      await db.delete(stores).where(eq(stores.id, input.id));
      return { success: true } as const;
    }),
});
