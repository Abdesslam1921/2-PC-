/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Orders, { sameWilayaCode } from "./Orders";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  label: vi.fn(),
  bulk: vi.fn(),
  sync: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      list: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 12,
              orderNumber: "ABD-000012",
              customerName: "محمد أمين",
              customerPhone: "0550000000",
              wilaya: "الجزائر",
              address: "الحي الجديد",
              total: "2500.00",
              fulfillmentStatus: "new",
              createdAt: new Date(),
              carrierTracking: "EC123456",
              shippingLabelUrl: null,
              items: [{ id: 1, title: "تجريبي" }],
            },
          ],
        }),
      },
      updateStatus: {
        useMutation: () => ({
          mutate: mocks.mutate,
          isPending: false,
          error: null,
        }),
      },
    },
    delivery: {
      carriers: {
        useQuery: () => ({
          data: [
            {
              id: 7,
              provider: "ecotrack",
              accountName: "HHD EXPRESS",
              status: "connected",
            },
          ],
        }),
      },
      createShippingLabel: {
        useMutation: () => ({ mutate: mocks.label, isPending: false }),
      },
      bulkUploadEcotrack: {
        useMutation: () => ({ mutate: mocks.bulk, isPending: false }),
      },
      syncEcotrackStatus: {
        useMutation: () => ({ mutate: mocks.sync, isPending: false }),
      },
    },
    useUtils: () => ({ orders: { list: { invalidate: mocks.invalidate } } }),
  },
}));

describe("Orders", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("matches Ecotrack wilaya codes with and without a leading zero", () => {
    expect(sameWilayaCode("05", 5)).toBe(true);
    expect(sameWilayaCode("16", "16")).toBe(true);
    expect(sameWilayaCode("09", "19")).toBe(false);
  });

  it("sends the selected operational status for an order", () => {
    render(<Orders />);
    expect(screen.getByText("ABD-000012")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("تحديث حالة ABD-000012"), {
      target: { value: "processing" },
    });
    expect(mocks.mutate).toHaveBeenCalledWith({
      orderId: 12,
      fulfillmentStatus: "processing",
    });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء بوليصة" }));
    expect(mocks.label).toHaveBeenCalledWith({
      orderId: 12,
      tracking: "EC123456",
    });
    fireEvent.click(screen.getByLabelText("تحديد ABD-000012"));
    fireEvent.click(
      screen.getByRole("button", { name: "رفع المحدد إلى Ecotrack" })
    );
    expect(mocks.bulk).toHaveBeenCalledWith({
      orderIds: [12],
      connectionId: 7,
    });
  });
});
