import { getDashboardStats } from "../db";
import { protectedProcedure, router, getStoreId } from "../_core/trpc";

export const dashboardRouter = router({
  stats: protectedProcedure.query(({ ctx }) =>
    getDashboardStats(getStoreId(ctx))
  ),
});
