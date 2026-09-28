/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForShip from "./ForShip";

const mocks = vi.hoisted(() => ({
  sync: vi.fn(),
  syncAll: vi.fn(),
  remove: vi.fn(),
  removeOne: vi.fn(),
  removeMany: vi.fn(),
  updateStatus: vi.fn(),
  invalidate: vi.fn(),
  pendingOrderId: null as number | null,
}));

const activeOrders = [
  {
    id: 12,
    orderNumber: "ABD-000012",
    customerName: "محمد أمين",
    customerPhone: "0550000000",
    fulfillmentStatus: "at_carrier",
    carrierTracking: "EC123456",
    carrierStatus: "in_transit",
    carrierStatusUpdatedAt: new Date(),
    items: [{ productId: 7, title: "منتج تجريبي", quantity: 2 }],
  },
  {
    id: 14,
    orderNumber: "ABD-000014",
    customerName: "أمينة",
    customerPhone: "0770000000",
    fulfillmentStatus: "at_carrier",
    carrierTracking: "EC123458",
    carrierStatus: "picked",
    carrierStatusUpdatedAt: new Date(),
    items: [{ productId: 7, title: "منتج تجريبي", quantity: 1 }],
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      list: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 11,
              orderNumber: "ABD-000011",
              customerName: "عميل جديد",
              customerPhone: "0551111111",
              fulfillmentStatus: "new",
              carrierTracking: null,
              carrierStatus: null,
              carrierStatusUpdatedAt: null,
              items: [{ productId: 7, title: "منتج تجريبي", quantity: 1 }],
            },
            ...activeOrders,
            {
              id: 13,
              orderNumber: "ABD-000013",
              customerName: "سارة",
              customerPhone: "0660000000",
              fulfillmentStatus: "returned",
              carrierTracking: "EC123457",
              carrierStatus: "return_received",
              carrierStatusUpdatedAt: new Date(),
              items: [{ productId: 7, title: "منتج تجريبي", quantity: 1 }],
            },
          ],
        }),
      },
      updateStatus: {
        useMutation: () => ({
          mutate: mocks.updateStatus,
          isPending: false,
          variables: undefined,
        }),
      },
      deleteArchived: {
        useMutation: () => ({ mutate: mocks.remove, isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: mocks.removeOne, isPending: false }),
      },
      deleteMany: {
        useMutation: () => ({ mutate: mocks.removeMany, isPending: false }),
      },
    },
    products: {
      list: { useQuery: () => ({ data: [{ id: 7, title: "منتج تجريبي" }] }) },
    },
    delivery: {
      sendMediaToWhatsApp: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      syncEcotrackStatus: {
        useMutation: () => ({
          mutate: mocks.sync,
          isPending: mocks.pendingOrderId !== null,
          variables:
            mocks.pendingOrderId !== null
              ? { orderId: mocks.pendingOrderId }
              : undefined,
        }),
      },
      syncAllEcotrackStatuses: {
        useMutation: () => ({ mutate: mocks.syncAll, isPending: false }),
      },
    },
    useUtils: () => ({ orders: { list: { invalidate: mocks.invalidate } } }),
  },
}));

afterEach(() => {
  cleanup();
  mocks.pendingOrderId = null;
});

describe("ForShip", () => {
  it("filters by product, switches to archive, and syncs a single shipment", () => {
    render(<ForShip />);
    expect(screen.getByText("ABD-000012")).toBeTruthy();
    expect(screen.queryByText("ABD-000011")).toBeNull();
    expect(screen.queryByText("ABD-000013")).toBeNull();
    fireEvent.change(screen.getByDisplayValue("كل المنتجات"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: /الأرشيف/ }));
    expect(screen.getByText("ABD-000013")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /قيد الشحن/ }));
    const row12 = screen.getByText("ABD-000012").closest("tr") as HTMLElement;
    fireEvent.click(within(row12).getByRole("button", { name: "مزامنة" }));
    expect(mocks.sync).toHaveBeenCalledWith({ orderId: 12 });
  });

  it("spins only the sync button of the order being synced", () => {
    mocks.pendingOrderId = 12;
    const { rerender } = render(<ForShip />);
    rerender(<ForShip />);
    const row12 = screen.getByText("ABD-000012").closest("tr") as HTMLElement;
    const row14 = screen.getByText("ABD-000014").closest("tr") as HTMLElement;
    expect(
      within(row12)
        .getByRole("button", { name: "مزامنة" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      within(row14)
        .getByRole("button", { name: "مزامنة" })
        .hasAttribute("disabled")
    ).toBe(false);
    expect(
      within(row12)
        .getByRole("button", { name: "مزامنة" })
        .querySelector(".animate-spin")
    ).toBeTruthy();
    expect(
      within(row14)
        .getByRole("button", { name: "مزامنة" })
        .querySelector(".animate-spin")
    ).toBeNull();
  });

  it("edits an order status manually from ProShip", () => {
    render(<ForShip />);
    const row12 = screen.getByText("ABD-000012").closest("tr") as HTMLElement;
    fireEvent.change(
      within(row12).getByLabelText("تعديل حالة الطلب ABD-000012"),
      { target: { value: "delivered" } }
    );
    expect(mocks.updateStatus).toHaveBeenCalledWith({
      orderId: 12,
      fulfillmentStatus: "delivered",
    });
  });
});
