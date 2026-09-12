import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Store, User } from "../../drizzle/schema";
import { getUserFromSessionCookie } from "./auth";
import { sdk } from "./sdk";
import { getActiveStoreForUser, resolveStoreByRequest } from "./stores";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  store: Store | null;
  storeId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    try {
      user = await getUserFromSessionCookie(opts.req);
    } catch (error) {
      user = null;
    }
  }

  let store: Store | null = null;
  if (user) {
    try {
      store = await getActiveStoreForUser(user.id, opts.req);
    } catch (error) {
      store = null;
    }
  } else {
    try {
      const localsStore = (
        opts.res.locals as { store?: Store | null } | undefined
      )?.store;
      store = localsStore ?? (await resolveStoreByRequest(opts.req));
    } catch (error) {
      store = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    store,
    storeId: store?.id ?? null,
  };
}
