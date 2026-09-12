/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductCreate from "./ProductCreate";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/products/create", mocks.setLocation],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      create: {
        useMutation: (options: any) => ({
          mutateAsync: async (input: any) => {
            mocks.mutateAsync(input);
            const product = {
              id: 11,
              title: input.title,
              images: [],
              variants: [],
            };
            options.onSuccess?.(product);
            return product;
          },
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ProductCreate variant interactions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("adds and removes a color option, then regenerates the variant rows", async () => {
    const user = userEvent.setup();
    render(<ProductCreate />);

    await user.click(screen.getByRole("switch"));
    expect(screen.getAllByRole("row")).toHaveLength(7);

    await user.type(screen.getByPlaceholderText("أضف لونًا"), "أزرق");
    await user.click(screen.getByRole("button", { name: "إضافة لون" }));
    expect(screen.getByRole("button", { name: /أزرق/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "تطبيق المتغيرات" }));
    expect(screen.getAllByRole("row")).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: /أزرق/ }));
    expect(screen.queryByRole("button", { name: /أزرق/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "تطبيق المتغيرات" }));
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("shows digital delivery settings and sends the uploaded file metadata", async () => {
    const user = userEvent.setup();
    render(<ProductCreate />);
    await user.type(
      screen.getByPlaceholderText("مثال: تيشيرت قطن أساسي"),
      "كتاب رقمي"
    );
    await user.click(screen.getByRole("button", { name: /منتج رقمي/ }));
    const file = new File(["pdf-content"], "guide.pdf", {
      type: "application/pdf",
    });
    const fileInput = document.querySelector(
      'input[type="file"][accept*=".pdf"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText("guide.pdf")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "حفظ المنتج" })[0]);
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          productKind: "digital",
          digitalMaxDownloads: 5,
          digitalLinkValidityHours: 72,
          digitalFile: expect.objectContaining({ fileName: "guide.pdf" }),
        })
      )
    );
  });

  it("adds a quantity offer with free delivery", async () => {
    const user = userEvent.setup();
    render(<ProductCreate />);
    await user.click(screen.getByRole("button", { name: /إضافة عرض/ }));
    await user.type(
      screen.getByPlaceholderText("مثال: باقة 2 قطع"),
      "باقة قطعتين"
    );
    expect(screen.getByText("العرض 1")).toBeTruthy();
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    await user.click(checkboxes.at(-1)!);
    expect(checkboxes.at(-1)?.checked).toBe(true);
  });

  it("saves owner-only Costs & Profitability settings", async () => {
    const user = userEvent.setup();
    render(<ProductCreate />);
    await user.type(
      screen.getByPlaceholderText("مثال: تيشيرت قطن أساسي"),
      "منتج الربحية"
    );
    await user.click(
      screen.getByRole("button", { name: /تكلفة إجمالية للمخزون/ })
    );
    const costSection = screen
      .getByText("Costs & Profitability")
      .closest("section")!;
    const totalCost = within(costSection).getAllByPlaceholderText("0.00")[0];
    await user.type(totalCost, "1200");
    const quantityInput = screen.getByPlaceholderText("1");
    await user.clear(quantityInput);
    await user.type(quantityInput, "10");
    const returnInput = within(costSection)
      .getAllByPlaceholderText("0.00")
      .at(-1)!;
    await user.type(returnInput, "150");
    await user.click(
      within(costSection).getByRole("checkbox", { name: "الروتور مجاني" })
    );
    await user.click(screen.getAllByRole("button", { name: "حفظ المنتج" })[0]);
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          costAccountingMode: "stock_total",
          costQuantity: 10,
          productCostTotal: "1200",
          returnCostPerOrder: "150",
          returnDeliveryFree: true,
        })
      )
    );
  });

  it("saves a product to the independent catalog and returns to the products list", async () => {
    const user = userEvent.setup();
    render(<ProductCreate />);

    await user.type(
      screen.getByPlaceholderText("مثال: تيشيرت قطن أساسي"),
      "حقيبة مستقلة"
    );
    await user.click(screen.getAllByRole("button", { name: "حفظ المنتج" })[0]);

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ title: "حقيبة مستقلة", status: "draft" })
      )
    );
    expect(mocks.setLocation).toHaveBeenCalledWith("/products");
  });
});
