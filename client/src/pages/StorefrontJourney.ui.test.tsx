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
import ProductLanding from "./ProductLanding";

const product = {
  id: 7,
  title: "حقيبة عملية",
  description: "حقيبة يومية",
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
      color: "أسود",
      size: "متوسط",
      price: "4200.00",
      compareAtPrice: "5100.00",
      stock: 4,
      available: true,
    },
  ],
};

const mocks = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      publicGet: { useQuery: () => ({ isLoading: false, data: product }) },
      publicList: {
        useQuery: () => ({
          isLoading: false,
          isFetching: false,
          data: [product],
        }),
      },
    },
    orders: {
      createCod: {
        useMutation: () => ({
          mutate: mocks.createOrder,
          isPending: false,
          error: null,
        }),
      },
    },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/p/7", vi.fn()],
  useRoute: () => [true, { id: "7" }],
}));

describe("Storefront shopping journey", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("sends a published product directly to COD without passing through the cart", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        if (typeof url === "string" && url.includes("ecotrack_bureaux")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  code: "31",
                  name: "السانية",
                  wilayaLatin: "Oran",
                  communeLatin: "Sania",
                  phone: "0",
                },
              ]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                commune_name: "السانية",
                wilaya_code: "31",
                wilaya_name: "وهران",
              },
            ]),
        });
      })
    );
    render(<ProductLanding />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /وهران/ })).toBeTruthy()
    );
    fireEvent.change(screen.getByPlaceholderText("الاسم واللقب"), {
      target: { value: "ريم علي" },
    });
    fireEvent.change(screen.getByPlaceholderText("05xxxxxxxx"), {
      target: { value: "0551111111" },
    });
    fireEvent.change(screen.getByLabelText("الولاية"), {
      target: { value: "وهران" },
    });
    fireEvent.change(screen.getByLabelText("البلدية"), {
      target: { value: "السانية" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "تأكيد الطلب والدفع عند الاستلام" })
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "ريم علي",
        customerPhone: "0551111111",
        wilaya: "وهران",
        address: "السانية",
        lines: [{ productId: 7, variantId: 11, quantity: 1 }],
      })
    );
  });
});
