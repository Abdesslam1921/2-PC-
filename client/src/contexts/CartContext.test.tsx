/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "./CartContext";

const mocks = vi.hoisted(() => ({ publicProducts: undefined as unknown }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      publicList: {
        useQuery: () => ({ data: mocks.publicProducts, isFetching: false }),
      },
    },
  },
}));

function CartHarness() {
  const { addItem, itemCount, items, subtotal, updateQuantity, removeItem } =
    useCart();
  return (
    <div>
      <button
        onClick={() =>
          addItem({
            productId: 7,
            variantId: 2,
            title: "حقيبة عملية",
            price: "4200.00",
            maxQuantity: 2,
          })
        }
      >
        أضف
      </button>
      <button
        onClick={() =>
          addItem({
            productId: 7,
            title: "حقيبة عملية",
            price: "7000.00",
            offerId: 12,
            offerDescription: "3 قطع بسعر خاص",
            offerQuantity: 3,
            freeDelivery: true,
            maxQuantity: 2,
          })
        }
      >
        عرض
      </button>
      <button onClick={() => updateQuantity("7-2", 3)}>ثلاثة</button>
      <button onClick={() => removeItem("7-2")}>حذف</button>
      <span data-testid="count">{itemCount}</span>
      <span data-testid="items">{items.length}</span>
      <span data-testid="subtotal">{subtotal}</span>
    </div>
  );
}

describe("CartContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.publicProducts = undefined;
  });
  afterEach(() => cleanup());

  it("persists independent catalog items and updates quantities locally", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "أضف" }));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("subtotal").textContent).toBe("4200");

    fireEvent.click(screen.getByRole("button", { name: "ثلاثة" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(
      JSON.parse(window.localStorage.getItem("abdou-store:cart") ?? "[]")[0]
    ).toMatchObject({ productId: 7, quantity: 2, maxQuantity: 2 });

    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    expect(screen.getByTestId("items").textContent).toBe("0");
  });

  it("stores the selected quantity offer as an independent discounted cart line", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "عرض" }));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("subtotal").textContent).toBe("7000");
    expect(
      JSON.parse(window.localStorage.getItem("abdou-store:cart") ?? "[]")[0]
    ).toMatchObject({
      offerId: 12,
      offerQuantity: 3,
      price: "7000.00",
      freeDelivery: true,
    });
  });

  it("removes a stored cart item when it is no longer available in the public catalog", async () => {
    window.localStorage.setItem(
      "abdou-store:cart",
      JSON.stringify([
        {
          lineId: "7-2",
          productId: 7,
          variantId: 2,
          title: "حقيبة قديمة",
          price: "4200.00",
          quantity: 1,
        },
      ])
    );
    mocks.publicProducts = [];
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("items").textContent).toBe("0")
    );
    expect(window.localStorage.getItem("abdou-store:cart")).toBeNull();
  });
});
