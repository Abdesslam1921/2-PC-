/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Storefront from "./Storefront";

const mocks = vi.hoisted(() => ({ addItem: vi.fn(), setLocation: vi.fn() }));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({
    items: [],
    itemCount: 0,
    subtotal: 0,
    addItem: mocks.addItem,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      publicList: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 7,
              title: "حقيبة عملية",
              description: "حقيبة مصنوعة للاستخدام اليومي",
              productType: "إكسسوارات",
              collectionName: "الأكثر طلبًا",
              price: "4200.00",
              compareAtPrice: "5100.00",
              inventory: 4,
              trackInventory: true,
              continueSelling: false,
              images: [{ id: 1, url: "/bag.jpg", altText: "حقيبة عملية" }],
              variants: [
                {
                  id: 11,
                  price: "4200.00",
                  compareAtPrice: "5100.00",
                  stock: 4,
                  available: true,
                },
              ],
            },
          ],
        }),
      },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/store", mocks.setLocation] }));

describe("Storefront", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders the live public catalog and adds an available product to the independent cart", () => {
    render(<Storefront />);
    expect(screen.getAllByText("حقيبة عملية").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الأكثر طلبًا").length).toBeGreaterThan(0);
    expect(
      screen
        .getByLabelText("قائمة تصنيفات المتجر")
        .classList.contains("sections-scrollbar")
    ).toBe(true);
    fireEvent.click(
      screen.getAllByRole("button", { name: /أضف إلى السلة/ })[0]
    );
    expect(mocks.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 7, variantId: 11, price: "4200.00" })
    );
  });
});
