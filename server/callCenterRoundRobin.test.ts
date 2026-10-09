import { describe, expect, it } from "vitest";
import {
  isCallCenterOrderVisibleToAgent,
  isDisabledAgentQueueOrder,
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
