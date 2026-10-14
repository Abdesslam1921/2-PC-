import { describe, expect, it } from "vitest";
import {
  agentCoversProducts,
  isCallCenterOrderVisibleToAgent,
  isDisabledAgentQueueOrder,
  isOrderInDistributionScope,
  pickRoundRobinAgentId,
} from "./callCenterDb";

describe("Call Center round-robin assignment", () => {
  it("returns null when no agents are eligible", () => {
    expect(pickRoundRobinAgentId([], 2, 1)).toBeNull();
  });

  it("keeps the same customer on the sticky agent when still eligible", () => {
    expect(pickRoundRobinAgentId([1, 2, 3], 2, 3)).toBe(2);
  });

  it("ignores a sticky agent who is no longer eligible", () => {
    expect(pickRoundRobinAgentId([1, 3], 2, 1)).toBe(3);
  });

  it("starts at the first eligible agent when nothing was assigned before", () => {
    expect(pickRoundRobinAgentId([4, 7, 9], null, null)).toBe(4);
  });

  it("rotates to the next eligible agent and wraps around", () => {
    expect(pickRoundRobinAgentId([4, 7, 9], null, 4)).toBe(7);
    expect(pickRoundRobinAgentId([4, 7, 9], null, 9)).toBe(4);
  });

  it("starts from the first eligible agent when the last assignee is gone", () => {
    expect(pickRoundRobinAgentId([4, 7, 9], null, 2)).toBe(4);
  });
});

describe("Call Center store-level distribution scope gate", () => {
  const base = { autoDistribute: true, productIds: [] as number[] };

  it("stops everything when the master switch is off", () => {
    expect(
      isOrderInDistributionScope(
        { ...base, autoDistribute: false, distributionScope: "all" },
        [1, 2]
      )
    ).toBe(false);
  });

  it("distributes every product when scope is all", () => {
    expect(
      isOrderInDistributionScope({ ...base, distributionScope: "all" }, [99])
    ).toBe(true);
  });

  it("distributes only the selected products when scope is specific", () => {
    const settings = {
      autoDistribute: true,
      distributionScope: "specific" as const,
      productIds: [1, 2],
    };
    expect(isOrderInDistributionScope(settings, [2, 3])).toBe(true);
    expect(isOrderInDistributionScope(settings, [7])).toBe(false);
  });

  it("fails safe when specific scope has no products", () => {
    expect(
      isOrderInDistributionScope(
        {
          autoDistribute: true,
          distributionScope: "specific",
          productIds: [],
        },
        [1]
      )
    ).toBe(false);
  });
});

describe("Call Center round-robin product scope (all vs specific)", () => {
  it("treats an agent with no assigned products as covering كل المنتجات", () => {
    expect(agentCoversProducts([], [10, 20])).toBe(true);
    expect(agentCoversProducts([], [])).toBe(true);
  });

  it("only covers orders that include at least one specific product", () => {
    expect(agentCoversProducts([10], [10, 20])).toBe(true);
    expect(agentCoversProducts([10], [20, 30])).toBe(false);
    expect(agentCoversProducts([10, 11], [11])).toBe(true);
  });
});

describe("Call Center agent order visibility", () => {
  it("shows a newly assigned order only to the assigned agent", () => {
    const order = {
      items: [{ productId: 10, confirmationAgentId: 5 }],
    };
    expect(isCallCenterOrderVisibleToAgent(order, 5, [], true)).toBe(true);
    expect(isCallCenterOrderVisibleToAgent(order, 8, [], true)).toBe(false);
  });

  it("keeps unassigned legacy orders on the previous product scope", () => {
    const order = {
      items: [{ productId: 10, confirmationAgentId: null }],
    };
    expect(isCallCenterOrderVisibleToAgent(order, 5, [10], false)).toBe(true);
    expect(isCallCenterOrderVisibleToAgent(order, 5, [11], false)).toBe(false);
    expect(isCallCenterOrderVisibleToAgent(order, 5, [], true)).toBe(true);
  });
});

describe("disabled agent queue return", () => {
  it("releases new and review orders that were not confirmation-costed", () => {
    expect(
      isDisabledAgentQueueOrder({
        fulfillmentStatus: "new",
        items: [{ confirmationSource: "owner" }],
      })
    ).toBe(true);
    expect(
      isDisabledAgentQueueOrder({
        fulfillmentStatus: "review",
        items: [{ confirmationSource: null }],
      })
    ).toBe(true);
  });

  it("keeps confirmed or costed orders with the disabled agent", () => {
    expect(
      isDisabledAgentQueueOrder({
        fulfillmentStatus: "confirmed",
        items: [{ confirmationSource: "owner" }],
      })
    ).toBe(false);
    expect(
      isDisabledAgentQueueOrder({
        fulfillmentStatus: "new",
        items: [{ confirmationSource: "call_center" }],
      })
    ).toBe(false);
  });
});
