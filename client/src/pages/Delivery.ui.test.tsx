/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Delivery from "./Delivery";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  invalidate: vi.fn(),
  refetch: vi.fn(),
  connect: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  carrierData: [] as Array<{
    id: number;
    provider: string;
    accountName: string;
    status: string;
  }>,
  data: {
    settings: {
      fixedOfficeEnabled: false,
      fixedOfficeFee: null,
      fixedHomeEnabled: false,
      fixedHomeFee: null,
      hiddenWilayaCodes: [],
    },
    wilayaRates: [],
  },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      delivery: { getSettings: { invalidate: mocks.invalidate } },
    }),
    delivery: {
      getSettings: { useQuery: () => ({ isLoading: false, data: mocks.data }) },
      saveSettings: {
        useMutation: () => ({ mutate: mocks.save, isPending: false }),
      },
      carriers: {
        useQuery: () => ({ data: mocks.carrierData, refetch: mocks.refetch }),
      },
      connectCarrier: {
        useMutation: () => ({ mutate: mocks.connect, isPending: false }),
      },
      updateEcotrackAccount: {
        useMutation: () => ({ mutate: mocks.update, isPending: false }),
      },
      deleteEcotrackAccount: {
        useMutation: () => ({ mutate: mocks.remove, isPending: false }),
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Delivery", () => {
  beforeEach(() => {
    mocks.carrierData = [];
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ wilaya_code: "16", wilaya_name: "الجزائر" }]),
        })
      )
    );
  });
  afterEach(() => cleanup());

  it("shows the Ecotrack account name and credentials form", async () => {
    mocks.carrierData = [
      {
        id: 7,
        provider: "ecotrack",
        accountName: "HHD EXPRESS",
        status: "connected",
      },
    ];
    render(<Delivery />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /ربط شركات التوصيل/ })
      ).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: /ربط شركات التوصيل/ }));
    expect(screen.getByText("HHD EXPRESS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إضافة حساب آخر" }));
    expect(screen.getByText("اسم الحساب (إجباري)")).toBeTruthy();
    expect(screen.getAllByText(/API Token/).length).toBeGreaterThan(0);
    expect(screen.queryByText("User GUID")).toBeNull();
  });

  it("loads wilayas automatically and saves their pricing from configuration", async () => {
    render(<Delivery />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /كونفيڤيراسيون التوصيل/ })
      ).toBeTruthy()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /كونفيڤيراسيون التوصيل/ })
    );
    await waitFor(() => expect(screen.getByText(/16 · الجزائر/)).toBeTruthy());
    expect(screen.getByText(/16 · الجزائر/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ الأسعار" })[0]!);
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        wilayaRates: [
          expect.objectContaining({
            wilayaCode: "16",
            officeEnabled: true,
            homeEnabled: true,
          }),
        ],
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /أقسام التوصيل/ }));
    fireEvent.click(screen.getByRole("button", { name: /ربط شركات التوصيل/ }));
    expect(screen.getByText("Yalidine")).toBeTruthy();
    expect(screen.getByText("Ecotrack")).toBeTruthy();
  });
});
