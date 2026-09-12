/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Products from "./Products";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  duplicateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  invalidate: vi.fn(),
  open: vi.fn(),
}));

vi.stubGlobal("open", mocks.open);

vi.mock("wouter", () => ({
  useLocation: () => ["/products", mocks.setLocation],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ products: { list: { invalidate: mocks.invalidate } } }),
    products: {
      list: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 14,
              title: "حقيبة مستقلة",
              createdAt: new Date("2026-08-25T10:00:00Z"),
              productType: "إكسسوارات",
              status: "active",
              price: "4500.00",
              inventory: 9,
              trackInventory: true,
              images: [{ id: 1, url: "/manus-storage/products/bag.jpg" }],
              variants: [{ id: 1 }],
            },
          ],
        }),
      },
      duplicate: {
        useMutation: (options: any) => ({
          mutate: (input: { id: number }) => {
            mocks.duplicateMutate(input);
            options.onSuccess?.({ id: 15, title: "حقيبة مستقلة — نسخة" });
          },
          isPending: false,
        }),
      },
      delete: {
        useMutation: (options: any) => ({
          mutate: (input: { id: number }) => {
            mocks.deleteMutate(input);
            options.onSuccess?.({ success: true });
          },
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe("Products independent catalog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders a product returned by the local catalog query", () => {
    render(<Products />);

    expect(screen.getByRole("button", { name: "حقيبة مستقلة" })).toBeTruthy();
    expect(screen.getByText("4500.00 دج")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "فتح صفحة هبوط حقيبة مستقلة" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "تعديل حقيبة مستقلة" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "تكرار حقيبة مستقلة" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "حذف حقيبة مستقلة" })
    ).toBeTruthy();
  });

  it("runs the row actions for landing, editing, duplication, and deletion", async () => {
    const user = userEvent.setup();
    render(<Products />);

    await user.click(
      screen.getByRole("button", { name: "فتح صفحة هبوط حقيبة مستقلة" })
    );
    expect(mocks.open).toHaveBeenCalledWith(
      "/p/14",
      "_blank",
      "noopener,noreferrer"
    );

    await user.click(
      screen.getByRole("button", { name: "تعديل حقيبة مستقلة" })
    );
    expect(mocks.setLocation).toHaveBeenCalledWith("/products/14/edit");

    await user.click(
      screen.getByRole("button", { name: "تكرار حقيبة مستقلة" })
    );
    expect(mocks.duplicateMutate).toHaveBeenCalledWith({ id: 14 });
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "حذف حقيبة مستقلة" }));
    expect(screen.getByRole("heading", { name: "حذف المنتج؟" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "حذف المنتج" }));
    expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: 14 });
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
  });
});
