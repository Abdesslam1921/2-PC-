/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FunnelImportSetup from "./FunnelImportSetup";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  createOrder: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/funnels/import", mocks.setLocation],
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    products: {
      list: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 9,
              title: "حقيبة عملية",
              price: "4200.00",
              images: [],
              variants: [],
            },
          ],
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

describe("FunnelImportSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:layout-preview"),
    });
    window.history.replaceState({}, "", "/funnels/import");
  });
  afterEach(() => cleanup());

  it("prevents advancing without imported media or a selected product", async () => {
    const user = userEvent.setup();
    const { container } = render(<FunnelImportSetup />);

    await user.click(screen.getByRole("button", { name: /التالي/ }));
    expect(mocks.error).toHaveBeenCalledWith(
      "أضف صورة أو فيديو واحدًا على الأقل لمعاينة التصميم."
    );

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File(["layout"], "layout.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: /التالي/ }));
    await user.click(screen.getByRole("button", { name: /التالي/ }));

    expect(mocks.error).toHaveBeenCalledWith("اختر منتجًا قبل المتابعة.");
    expect(screen.getByRole("heading", { name: "اختر المنتج" })).toBeTruthy();
  });

  it("moves from imported media through product, defaults, payment, and landing details", async () => {
    const user = userEvent.setup();
    const { container } = render(<FunnelImportSetup />);
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File(["layout"], "layout.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: /التالي/ }));

    await user.click(screen.getByRole("button", { name: /حقيبة عملية/ }));
    await user.click(screen.getByRole("button", { name: /التالي/ }));
    expect(screen.getByText("شريط الإعلان")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /التالي/ }));
    expect(screen.getByText("الدفع عند الاستلام")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /الدفع الإلكتروني/ }));

    await user.click(screen.getByRole("button", { name: /التالي/ }));
    expect(screen.getAllByText("تفاصيل صفحة الهبوط")).toHaveLength(2);
    expect(screen.getByText("Meta Pixel")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "إنشاء" }));
    expect(screen.getByText("اطلب حقيبة عملية الآن")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "اطلب الآن · الدفع عند الاستلام" })
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /العودة للتعديل/ }));
    expect(screen.getAllByText("تفاصيل صفحة الهبوط").length).toBeGreaterThan(0);
  });
});
