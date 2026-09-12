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

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      publicGet: {
        useQuery: () => ({
          isLoading: false,
          data: {
            id: 7,
            title: "حقيبة عملية",
            description: "حقيبة يومية",
            productType: "إكسسوارات",
            collectionName: null,
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
          },
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
  useLocation: () => ["/p/7", mocks.setLocation],
  useRoute: () => [true, { id: "7" }],
}));

describe("ProductLanding", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("submits the selected live variant through the direct COD form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown) => {
        if (typeof url === "string" && url.includes("ecotrack_bureaux")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  code: "16",
                  name: "بئر مراد رايس",
                  wilayaLatin: "Alger",
                  communeLatin: "Bir Mourad Rais",
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
                commune_name: "بئر مراد رايس",
                wilaya_code: "16",
                wilaya_name: "الجزائر",
              },
            ]),
        });
      })
    );
    render(<ProductLanding />);
    expect(screen.getByText("حقيبة عملية")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /الجزائر/ })).toBeTruthy()
    );
    fireEvent.change(screen.getByPlaceholderText("الاسم واللقب"), {
      target: { value: "ليلى أحمد" },
    });
    fireEvent.change(screen.getByPlaceholderText("05xxxxxxxx"), {
      target: { value: "0550000000" },
    });
    fireEvent.change(screen.getByLabelText("الولاية"), {
      target: { value: "الجزائر" },
    });
    fireEvent.change(screen.getByLabelText("البلدية"), {
      target: { value: "بئر مراد رايس" },
    });
    fireEvent.click(screen.getByRole("button", { name: "زيادة الكمية" }));
    fireEvent.click(
      screen.getByRole("button", { name: "تأكيد الطلب والدفع عند الاستلام" })
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "ليلى أحمد",
        wilaya: "الجزائر",
        address: "بئر مراد رايس",
        lines: [{ productId: 7, variantId: 11, quantity: 2 }],
      })
    );
  });
});
