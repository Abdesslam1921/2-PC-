import { z } from "zod";
import {
  getOrderCleanAnalytics,
  getOrderCleanEvents,
  getOrderCleanSettings,
  saveOrderCleanSettings,
} from "../db";
import { protectedProcedure, router, getStoreId } from "../_core/trpc";

const settingsInput = z.object({
  enabled: z.boolean(),
  duplicateWindowHours: z.number().int().min(1).max(720),
  maxOrdersPerPhone: z.number().int().min(1).max(10),
  action: z.enum(["review", "block"]),
});

export const orderCleanRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getOrderCleanSettings(getStoreId(ctx))
  ),
  analytics: protectedProcedure.query(({ ctx }) =>
    getOrderCleanAnalytics(getStoreId(ctx))
  ),
  events: protectedProcedure.query(({ ctx }) =>
    getOrderCleanEvents(getStoreId(ctx))
  ),
  saveSettings: protectedProcedure
    .input(settingsInput)
    .mutation(({ ctx, input }) =>
      saveOrderCleanSettings(ctx.user.id, getStoreId(ctx), input)
    ),
});

export const ORDER_CLEAN_RULES = {
  maxDuplicateWindowHours: 720,
  maxOrdersPerPhone: 10,
  actions: ["review", "block"] as const,
};
