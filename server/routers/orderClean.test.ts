import { describe, expect, it } from "vitest";
import { ORDER_CLEAN_RULES } from "./orderClean";

describe("OrderClean contract", () => {
  it("supports review and block actions", () => {
    expect(ORDER_CLEAN_RULES.actions).toEqual(["review", "block"]);
  });

  it("limits duplicate settings to safe operational bounds", () => {
    expect(ORDER_CLEAN_RULES.maxDuplicateWindowHours).toBe(720);
    expect(ORDER_CLEAN_RULES.maxOrdersPerPhone).toBe(10);
  });
});
