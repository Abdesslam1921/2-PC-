/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Storefront from "./Storefront";

const mocks = vi.hoisted(() => ({
  updateQuantity: vi.fn(),
  removeItem: vi.fn(),
  clearCart: vi.fn(),
  setLocation: vi.fn(),
}));
const cart = {
  items: [
    {
      lineId: "7-11",
      productId: 7,
      variantId: 11,
      title: "حقيبة عملية",
      imageUrl: "/bag.jpg",
      price: "4200.00",
      quantity: 2,
      maxQuantity: 4,
    },
  ],
  itemCount: 2,
  subtotal: 8400,
  addItem: vi.fn(),
  updateQuantity: mocks.updateQuantity,
  removeItem: mocks.removeItem,
  clearCart: mocks.clearCart,
};

vi.mock("@/contexts/CartContext", () => ({ useCart: () => cart }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      publicList: { useQuery: () => ({ isLoading: false, data: [] }) },
    },
    orders: {
      createCod: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
      },
    },
    digital: {
      createOrder: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
      },
    },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/store/cart", mocks.setLocation],
}));

describe("Storefront cart and checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cart.items = [
      {
        lineId: "7-11",
        productId: 7,
        variantId: 11,
        title: "حقيبة عملية",
        imageUrl: "/bag.jpg",
        price: "4200.00",
        quantity: 2,
        maxQuantity: 4,
      },
    ];
    cart.itemCount = 2;
    cart.subtotal = 8400;
  });
  afterEach(() => cleanup());

  it("updates quantities, removes an item, and displays the live cart summary", () => {
    render(<Storefront view="cart" />);
    expect(screen.getByText("حقيبة عملية")).toBeTruthy();
    expect(screen.getByText("ملخص السلة")).toBeTruthy();
    const total = `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(8400)} دج`;
    expect(screen.getAllByText(total).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(
      screen.getByRole("button", { name: "زيادة كمية حقيبة عملية" })
    );
    expect(mocks.updateQuantity).toHaveBeenCalledWith("7-11", 3);
    fireEvent.click(screen.getByRole("button", { name: "حذف حقيبة عملية" }));
    expect(mocks.removeItem).toHaveBeenCalledWith("7-11");
  });

  it("shows items and total in the checkout review", () => {
    render(<Storefront view="checkout" />);
    expect(screen.getByText("بيانات الاستلام")).toBeTruthy();
    expect(screen.getByText("حقيبة عملية")).toBeTruthy();
    expect(screen.getByText("الكمية: 2")).toBeTruthy();
    const total = `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(8400)} دج`;
    expect(screen.getAllByText(total).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("الدفع عند الاستلام")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /تأكيد الطلب والدفع عند الاستلام/ })
    ).toBeTruthy();
  });
});
