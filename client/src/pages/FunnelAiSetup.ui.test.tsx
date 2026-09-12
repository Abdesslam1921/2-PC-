/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FunnelAiSetup from "./FunnelAiSetup";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  mutate: vi.fn(),
  open: vi.fn(),
}));

vi.stubGlobal("open", mocks.open);

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/funnels/ai", mocks.setLocation],
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
              id: 5,
              title: "حقيبة عملية",
              price: "4200.00",
              images: [{ url: "/bag.png" }],
              variants: [],
            },
          ],
        }),
      },
    },
    landings: {
      createAiDraft: {
        useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
      },
    },
  },
}));

describe("FunnelAiSetup", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("creates an AIDA draft from a real product after landing settings", async () => {
    const user = userEvent.setup();
    render(<FunnelAiSetup />);
    await user.selectOptions(screen.getByLabelText("اختر المنتج"), "5");
    await user.click(screen.getByRole("button", { name: /متوسط/ }));
    await user.type(
      screen.getByLabelText("مواصفات الكتابة المخصصة"),
      "ركز على التوصيل"
    );
    await user.click(
      screen.getByRole("button", { name: "متابعة إعداد التصميم" })
    );
    expect(screen.getByLabelText("مسار الرابط")).toBeTruthy();
    await user.clear(screen.getByLabelText("مسار الرابط"));
    await user.type(screen.getByLabelText("مسار الرابط"), "sac-pratique");
    await user.click(
      screen.getByRole("button", { name: "إنشاء المسودة بالذكاء الاصطناعي" })
    );
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 5,
        pageLength: "medium",
        notes: "ركز على التوصيل",
        settings: expect.objectContaining({
          slug: "sac-pratique",
          payment: "cod",
        }),
      })
    );
  });
});
