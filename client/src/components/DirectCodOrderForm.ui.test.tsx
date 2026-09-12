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
});
