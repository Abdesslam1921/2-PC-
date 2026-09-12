// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Checkout from "./Checkout";

const mocks = vi.hoisted(() => ({
  clearCart: vi.fn(),
  mutate: vi.fn(),
  setLocation: vi.fn(),
  digitalMode: false,
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({
    items: mocks.digitalMode
      ? [
          {
            lineId: "9-base",
            productId: 9,
            productKind: "digital",
            title: "دليل رقمي",
            price: "1200.00",
            quantity: 1,
          },
        ]
      : [
          {
            lineId: "7-11",
            productId: 7,
            variantId: 11,
            title: "حقيبة عملية",
            price: "4200.00",
            quantity: 2,
          },
        ],
    subtotal: 8400,
    itemCount: 2,
    clearCart: mocks.clearCart,
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      createCod: {
        useMutation: ({
          onSuccess,
        }: {
          onSuccess: (value: { orderNumber: string; total: string }) => void;
        }) => ({
          mutate: (input: unknown) => {
            mocks.mutate(input);
            onSuccess({ orderNumber: "ABD-000012", total: "8400.00" });
          },
          isPending: false,
          error: null,
        }),
      },
    },
    digital: {
      createOrder: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
      },
    },
    thankYou: {
      publicForProduct: {
        useQuery: () => ({
          data: {
            enabled: true,
            message: "تم إرسال طلبك بنجاح.",
            buttonText: "خروج",
            buttonUrl: "/",
          },
        }),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/store/checkout", mocks.setLocation],
}));

describe("Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.digitalMode = false;
  });
  afterEach(() => cleanup());

  it("shows only email details for a digital checkout without shipping fields", () => {
    mocks.digitalMode = true;
    render(<Checkout />);
    expect(screen.getByText("بيانات التسليم الرقمي")).toBeTruthy();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeTruthy();
    expect(screen.queryByLabelText("الولاية")).toBeNull();
    expect(screen.queryByLabelText("العنوان بالتفصيل")).toBeNull();
    expect(screen.getByText("الدفع الإلكتروني")).toBeTruthy();
  });

  it("submits customer details as a cash-on-delivery order and confirms the saved order", () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), {
      target: { value: "محمد أمين" },
    });
    fireEvent.change(screen.getByLabelText("رقم الهاتف"), {
      target: { value: "0550000000" },
    });
    fireEvent.change(screen.getByLabelText("الولاية"), {
      target: { value: "الجزائر" },
    });
    fireEvent.change(screen.getByLabelText("العنوان بالتفصيل"), {
      target: { value: "الحي الجديد، شارع 1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /تأكيد الطلب والدفع عند الاستلام/ })
    );

    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "محمد أمين",
        customerPhone: "0550000000",
        wilaya: "الجزائر",
        lines: [{ productId: 7, variantId: 11, quantity: 2 }],
      })
    );
    expect(mocks.clearCart).toHaveBeenCalledOnce();
    expect(screen.getAllByText("ABD-000012").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "خروج" }).getAttribute("href")
    ).toBe("/");
  });
});
