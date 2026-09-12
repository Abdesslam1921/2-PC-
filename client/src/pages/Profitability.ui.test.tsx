// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Profitability from "./Profitability";

const { state } = vi.hoisted(() => {
  const state = {
    campaigns: [] as Array<{
      campaignId: string;
      campaignName: string;
      productId: number | null;
    }>,
    products: [] as Array<{ id: number; title: string }>,
    saveLinks: vi.fn(),
    startOAuth: vi.fn(),
  };
  return { state };
});

vi.mock("@/lib/trpc", () => ({
  trpc: {
    profitability: {
      report: {
        useQuery: () => ({
          data: {
            totals: {
              trueProfit: "0.00",
              revenue: "0.00",
              totalCost: "0.00",
              profitMargin: "0.00%",
              adSpend: "0.00",
              cpa: "0.00",
              roas: "0.00",
            },
            counts: {
              deliveredOrders: 0,
              returnedOrders: 0,
              pendingOrders: 0,
              excludedOrders: 0,
            },
            byProduct: [],
            byCampaign: [],
            byOrder: [],
            meta: { syncedCampaigns: 0, syncedInsights: 0 },
          },
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
      settings: {
        useQuery: () => ({
          data: { usdToDzdRate: "135.00", includePendingOrders: false },
          refetch: vi.fn(),
        }),
      },
      metaAccounts: {
        useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
      },
      campaignLinks: {
        useQuery: () => ({
          data: state.campaigns,
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
      saveCampaignLinks: {
        useMutation: () => ({ mutate: state.saveLinks, isPending: false }),
      },
      saveSettings: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      saveMetaAccount: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      removeMetaAccount: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      syncMetaAccount: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      analyzeCampaigns: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    products: {
      list: { useQuery: () => ({ data: state.products, isLoading: false }) },
    },
    mediaBuying: {
      startOAuth: {
        useMutation: () => ({ mutate: state.startOAuth, isPending: false }),
      },
    },
  },
}));

vi.mock("@/components/PageIntro", () => ({
  PageIntro: ({
    title,
    action,
  }: {
    title: string;
    action: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {action}
    </header>
  ),
}));

describe("Profitability", () => {
  beforeEach(() => {
    state.campaigns = [];
    state.products = [];
    state.saveLinks.mockClear();
    state.startOAuth.mockClear();
  });

  afterEach(() => cleanup());

  it("starts Meta OAuth from the primary connection button", () => {
    render(<Profitability />);
    fireEvent.click(
      screen.getByRole("button", { name: "ربط حساب Meta عبر Facebook" })
    );
    expect(state.startOAuth).toHaveBeenCalledTimes(1);
  });

  it("explains that campaigns must be synced before linking appears", () => {
    render(<Profitability />);
    expect(screen.getByText("ربط الحملة الإعلانية بالمنتج")).toBeTruthy();
    expect(screen.getByText(/لا توجد حملات بعد/)).toBeTruthy();
  });

  it("links a synced campaign to its product and saves the mapping", () => {
    state.campaigns = [
      {
        campaignId: "23847564390751",
        campaignName: "حملة المنتج الأول",
        productId: null,
      },
    ];
    state.products = [{ id: 42, title: "منتج تجريبي" }];
    render(<Profitability />);
    fireEvent.change(
      screen.getByLabelText("المنتج المرتبط بالحملة حملة المنتج الأول"),
      { target: { value: "42" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "حفظ الربط" }));
    expect(state.saveLinks).toHaveBeenCalledWith({
      links: [{ campaignId: "23847564390751", productId: 42 }],
    });
  });
});
