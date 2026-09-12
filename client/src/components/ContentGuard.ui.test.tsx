// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({
  query: vi.fn(() => ({
    data: {
      enabled: true,
      protectImages: true,
      blockRightClick: true,
      preventSelection: true,
      watermarkEnabled: true,
      watermarkText: "Abdou Store",
      blockHotlink: false,
      blockAdReferrers: false,
      blockMetaAdsLibrary: false,
      blockedMessage: "غير متاح",
    },
  })),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: { contentGuard: { publicForProduct: { useQuery: query } } },
}));

import { ContentGuard } from "./ContentGuard";

afterEach(() => {
  cleanup();
  query.mockClear();
});

describe("ContentGuard", () => {
  it("shows the configured watermark without blocking the page", () => {
    render(<ContentGuard productId={7} />);
    expect(screen.getByText("Abdou Store")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
