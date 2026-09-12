/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingPreview from "./LandingPreview";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  invalidate: vi.fn(),
  regenerate: vi.fn(),
  approve: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const page = {
  id: 81,
  productId: 7,
  title: "عطر أصلي",
  designSystemJson: JSON.stringify({
    primaryColor: "#A66A1F",
    secondaryColor: "#24130D",
    accentColor: "#E9C16A",
    backgroundTone: "دافئ",
    visualMood: "فاخر",
  }),
  assets: [
    {
      id: 1,
      landingSectionId: null,
      kind: "original_product",
      sourceUrl: "/manus-storage/product.png",
    },
    {
      id: 2,
      landingSectionId: 1,
      kind: "composition",
      sourceUrl: "/manus-storage/composition.png",
    },
  ],
  sections: [
    {
      id: 1,
      eyebrow: "عطر",
      aidaStage: "attention",
      headline: "رائحة تترك أثرًا",
      body: "وصف قصير",
      bulletsJson: JSON.stringify(["ثبات مميز"]),
      ctaLabel: "اطلب الآن",
      productImageUrl: "/manus-storage/product.png",
    },
  ],
};

vi.mock("wouter", () => ({
  useLocation: () => ["/funnels/ai/preview/81", mocks.setLocation],
  useRoute: () => [true, { id: "81" }],
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      landings: {
        get: { invalidate: mocks.invalidate },
        list: { invalidate: mocks.invalidate },
      },
    }),
    landings: {
      get: { useQuery: () => ({ isLoading: false, data: page }) },
      regenerateScenes: {
        useMutation: () => ({ mutate: mocks.regenerate, isPending: false }),
      },
      approve: {
        useMutation: () => ({ mutate: mocks.approve, isPending: false }),
      },
    },
    products: {
      publicGet: {
        useQuery: () => ({
          data: {
            id: 7,
            title: "عطر أصلي",
            price: "3000.00",
            continueSelling: false,
            trackInventory: false,
            images: [],
            variants: [],
          },
        }),
      },
    },
    orders: {
      createCod: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe("LandingPreview", () => {
  afterEach(() => cleanup());
  it("renders the private AIDA draft using its generated creative composition", () => {
    render(<LandingPreview />);
    expect(screen.getByText("معاينة خاصة · غير محفوظة")).toBeTruthy();
    expect(screen.getByText("رائحة تترك أثرًا")).toBeTruthy();
    expect(
      screen.getByAltText("مشهد إعلاني مولد للمنتج").getAttribute("src")
    ).toBe("/manus-storage/composition.png");
    expect(screen.getByRole("button", { name: "اطلب الآن" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "اطلب الآن · الدفع عند الاستلام" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "اعتماد وحفظ الفانل" })
    ).toBeTruthy();
  });
});
