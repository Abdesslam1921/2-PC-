import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { users, type User } from "../../drizzle/schema";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../_core/auth";
import { getSessionCookieOptions } from "../_core/cookies";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("بريد إلكتروني غير صالح.")
  .max(320, "البريد الإلكتروني طويل جدًا.");

function toPublicUser(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) =>
    ctx.user ? toPublicUser(ctx.user) : null
  ),

  register: publicProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "الاسم مطلوب.")
          .max(160, "الاسم طويل جدًا."),
        email: emailSchema,
        password: z
          .string()
          .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل.")
          .max(128, "كلمة المرور طويلة جدًا."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "قاعدة البيانات غير متاحة حاليًا.",
        });
      }

      const email = input.email.trim().toLowerCase();
      const passwordHash = await hashPassword(input.password);

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing?.passwordHash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "هذا البريد الإلكتروني مستخدم بالفعل.",
        });
      }

      let user: User;

      if (existing) {
        // Link a password to an existing account (e.g. from OAuth) so its data
        // and role are preserved instead of creating a duplicate owner.
        await db
          .update(users)
          .set({
            passwordHash,
            name: input.name.trim(),
            lastSignedIn: new Date(),
          })
          .where(eq(users.id, existing.id));

        const [updated] = await db
          .select()
          .from(users)
          .where(eq(users.id, existing.id))
          .limit(1);
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر تحميل الحساب.",
          });
        }
        user = updated;
      } else {
        const openId = `email_${nanoid(24)}`;
        const [created] = await db.insert(users).values({
          openId,
          name: input.name.trim(),
          email,
          loginMethod: "email",
          passwordHash,
          role: "user",
          lastSignedIn: new Date(),
        });

        const userId = Number(created?.insertId);
        if (!userId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر إنشاء الحساب.",
          });
        }

        const [fetched] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!fetched) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر تحميل الحساب.",
          });
        }
        user = fetched;
      }

      const token = await createSessionToken({
        openId: user.openId,
        email: user.email,
        name: user.name,
      });
      ctx.res.cookie(SESSION_COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: SESSION_MAX_AGE_MS,
      });

      return toPublicUser(user);
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "كلمة المرور مطلوبة."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "قاعدة البيانات غير متاحة حاليًا.",
        });
      }

      const email = input.email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (
        !user ||
        !user.passwordHash ||
        !(await verifyPassword(input.password, user.passwordHash))
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        });
      }

      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const token = await createSessionToken({
        openId: user.openId,
        email: user.email,
        name: user.name,
      });
      ctx.res.cookie(SESSION_COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: SESSION_MAX_AGE_MS,
      });

      return toPublicUser(user);
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
