// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Settings from "./Settings";

const setLocation = vi.fn();
const saveDomain = vi.fn();

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "مالك المتجر", email: "owner@example.com" },
    loading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/settings", setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    connecteurs: {
      list: {
        useQuery: () => ({
          data: [
            {
              kind: "facebook_domain",
              domain: "old.example.com",
              verificationCode: "old",
              enabled: false,
            },
          ],
          refetch: vi.fn(),
        }),
      },
      save: { useMutation: () => ({ mutate: saveDomain, isPending: false }) },
    },
  },
}));

describe("Settings", () => {
  it("starts with profile, opens the menu sections, and saves a domain", () => {
    render(<Settings />);
    expect(screen.getByRole("heading", { name: "الملف الشخصي" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /القائمة/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /اسم النطاق/ })[1]);
    expect(screen.getByRole("heading", { name: "اسم النطاق" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("store.example.com"), {
      target: { value: "shop.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ إعدادات النطاق/ }));
    expect(saveDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "facebook_domain",
        domain: "shop.example.com",
      })
    );
  });
});
