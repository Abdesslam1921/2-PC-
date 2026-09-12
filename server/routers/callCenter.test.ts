import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  login: vi.fn(),
  dashboard: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../callCenterDb", () => ({
  createCallCenterAgent: mocks.create,
  listCallCenterAgents: mocks.list,
  loginCallCenterAgent: mocks.login,
  getCallCenterDashboard: mocks.dashboard,
  deleteCallCenterAgent: mocks.remove,
  updateCallCenterAgent: mocks.update,
}));

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function context(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "owner",
      name: "مالك",
      email: "owner@example.com",
      role: "admin",
    },
    store: {
      id: 7,
      ownerId: 42,
      name: "متجر",
      slug: "store",
      language: "dz-ar",
      templateId: null,
      aiStyleConfig: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    storeId: 7,
    req: {} as never,
    res: {} as never,
  };
}

describe("Call Center router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an owner-scoped agent with selected products", async () => {
    mocks.create.mockResolvedValue({
      id: 8,
      name: "فريق التأكيد",
      email: "agent@gmail.com",
      enabled: true,
      productIds: [3, 4],
    });
    const result = await appRouter
      .createCaller(context())
      .callCenter.create({
        name: "فريق التأكيد",
        email: "agent@gmail.com",
        password: "safe-pass-123",
        productIds: [3, 4],
      });
    expect(mocks.create).toHaveBeenCalledWith(42, 7, {
      name: "فريق التأكيد",
      email: "agent@gmail.com",
      password: "safe-pass-123",
      notifyNewOrders: true,
      notifyStatusChanges: true,
      notifyCancelledOrders: true,
      notifyUnresponsiveOrders: true,
      notifyFollowUp: true,
      compensationMode: "all_orders",
      generalOrderRate: "0.00",
      completedOrderRate: "0.00",
      productIds: [3, 4],
    });
    expect(result.productIds).toEqual([3, 4]);
  });

  it("returns an opaque login token and an isolated dashboard contract", async () => {
    mocks.login.mockResolvedValue({
      token: "a".repeat(64),
      agent: {
        id: 8,
        ownerId: 42,
        name: "فريق التأكيد",
        email: "agent@example.com",
      },
    });
    mocks.dashboard.mockResolvedValue({
      agent: { id: 8, name: "فريق التأكيد", email: "agent@example.com" },
      products: [{ id: 3, title: "منتج" }],
      stats: { total: 1, new: 1, confirmed: 0, shipped: 0, cancelled: 0 },
      orders: [],
    });
    const caller = appRouter.createCaller(context());
    const login = await caller.callCenter.login({
      email: "agent@example.com",
      password: "safe-pass-123",
    });
    const dashboard = await caller.callCenter.dashboard({ token: login.token });
    expect(login.token).toHaveLength(64);
    expect(dashboard.stats.total).toBe(1);
    expect(mocks.dashboard).toHaveBeenCalledWith(login.token);
  });
});
