// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectCodOrderForm } from "./DirectCodOrderForm";

const mocks = vi.hoisted(() => ({ open: vi.fn(), mutate: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      createCod: {
        useMutation: (options: {
          onSuccess: (result: { orderNumber: string; total: string }) => void;
        }) => ({
          mutate: (input: unknown) => {
            mocks.mutate(input);
            options.onSuccess({ orderNumber: "ABD-000123", total: "4800.00" });
          },
          isPending: false,
          error: null,
        }),
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

describe("DirectCodOrderForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.stubGlobal("open", mocks.open);
  });
  afterEach(() => cleanup());

  it("uses linked wilaya and commune selections, sends quantity, then shows confirmation without WhatsApp redirect", async () => {
    render(
      <DirectCodOrderForm
        productId={7}
        variantId={11}
        productTitle="حقيبة"
        price="2400.00"
        maxQuantity={3}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /وهران/ })).toBeTruthy()
    );
    fireEvent.change(screen.getByPlaceholderText("الاسم واللقب"), {
      target: { value: "ليلى أحمد" },
    });
    fireEvent.change(screen.getByPlaceholderText("05xxxxxxxx"), {
      target: { value: "0550000000" },
    });
    fireEvent.change(screen.getByLabelText("الولاية"), {
      target: { value: "وهران" },
    });
    fireEvent.change(screen.getByLabelText("البلدية"), {
      target: { value: "السانية" },
    });
    fireEvent.click(screen.getByRole("button", { name: "زيادة الكمية" }));
    fireEvent.click(
      screen.getByRole("button", { name: "تأكيد الطلب والدفع عند الاستلام" })
    );
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "السانية",
        lines: [{ productId: 7, variantId: 11, quantity: 2 }],
      })
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(mocks.open).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "خروج" }).getAttribute("href")
    ).toBe("/");
  });

  it("shows quantity tiers inside the form and toggles the chosen one", () => {
    const onSelectOffer = vi.fn();
    render(
      <DirectCodOrderForm
        productId={7}
        productTitle="حقيبة"
        price="2400.00"
        maxQuantity={3}
        offerTiers={[
          {
            id: 5,
            description: "قطعتان",
            quantity: 2,
            price: "4000.00",
            compareAtPrice: "4800.00",
            maxUses: 0,
            usedCount: 0,
            freeDelivery: false,
          },
        ]}
        onSelectOffer={onSelectOffer}
      />
    );
    expect(screen.getByText("قطعتان")).toBeTruthy();
    expect(screen.getByText(/2 قطع/)).toBeTruthy();
    // The real price (2 × 2400) is shown struck through + the amount saved.
    expect(screen.getByText(/4.?800/)).toBeTruthy();
    expect(screen.getByText(/وفّر .*دج/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /قطعتان/ }));
    expect(onSelectOffer).toHaveBeenCalledWith(5);
  });

  it("badges a tier that carries free delivery", () => {
    render(
      <DirectCodOrderForm
        productId={7}
        productTitle="حقيبة"
        price="3000.00"
        maxQuantity={3}
        offerId={6}
        offerTiers={[
          {
            id: 6,
            description: "قطعتان بتوصيل مجاني",
            quantity: 2,
            price: "3000.00",
            compareAtPrice: "4000.00",
            maxUses: 0,
            usedCount: 0,
            freeDelivery: true,
          },
        ]}
      />
    );
    expect(screen.getByText("توصيل مجاني")).toBeTruthy();
    expect(
      screen.getByText("توصيل مجاني على هذا الطلب — لا تدفع أي رسوم توصيل.")
    ).toBeTruthy();
  });

  it("announces free delivery immediately for a free-delivery product", () => {
    render(
      <DirectCodOrderForm
        productId={7}
        productTitle="حقيبة"
        price="2400.00"
        maxQuantity={3}
        productFreeDelivery
      />
    );
    expect(
      screen.getByText("توصيل مجاني على هذا الطلب — لا تدفع أي رسوم توصيل.")
    ).toBeTruthy();
  });

  it("locks the quantity to the chosen tier", () => {
    render(
      <DirectCodOrderForm
        productId={7}
        productTitle="حقيبة"
        price="4000.00"
        maxQuantity={3}
        offerId={5}
        offerTiers={[
          {
            id: 5,
            description: "قطعتان",
            quantity: 2,
            price: "4000.00",
            maxUses: 0,
            usedCount: 0,
            freeDelivery: false,
          },
        ]}
      />
    );
    expect(screen.getByText("2 قطع ضمن العرض المختار")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "زيادة الكمية" })).toBeNull();
  });
});
