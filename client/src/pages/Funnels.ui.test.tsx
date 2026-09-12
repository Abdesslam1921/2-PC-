/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Funnels from "./Funnels";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  path: "/funnels",
  open: vi.fn(),
}));

vi.stubGlobal("open", mocks.open);

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [mocks.path, mocks.setLocation],
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    landings: {
      list: {
        useQuery: () => ({
          isLoading: false,
          data: [
            {
              id: 81,
              title: "حقيبة عملية",
              slug: "sac-pratique",
              framework: "AIDA",
              pageLength: "short",
              status: "ready",
              createdAt: new Date("2026-08-26"),
            },
          ],
        }),
      },
    },
  },
}));

describe("Funnels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.path = "/funnels";
  });
  afterEach(() => cleanup());

  it("shows the saved funnel history and opens the preview", async () => {
    const user = userEvent.setup();
    render(<Funnels />);
    expect(screen.getByText("سجل الفانلات")).toBeTruthy();
    expect(screen.getByText("حقيبة عملية")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "معاينة" }));
    expect(mocks.open).toHaveBeenCalledWith(
      "/funnels/ai/preview/81",
      "_blank",
      "noopener,noreferrer"
    );
    await user.click(screen.getByRole("button", { name: "إنشاء فانل" }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/funnels/create");
  });

  it("opens the appropriate setup path from the create funnel screen", async () => {
    mocks.path = "/funnels/create";
    const user = userEvent.setup();
    render(<Funnels />);
    const startButtons = screen.getAllByRole("button", { name: "ابدأ الآن" });
    await user.click(startButtons[0]);
    expect(mocks.setLocation).toHaveBeenCalledWith("/funnels/ai");
    await user.click(startButtons[1]);
    expect(mocks.setLocation).toHaveBeenCalledWith("/funnels/import");
  });
});
