import { describe, expect, it } from "vitest";
import { normalizeContactNumber } from "./ContactBar";

describe("ContactBar number handling", () => {
  it("normalizes an Algerian local number for external links", () => {
    expect(normalizeContactNumber("0662 774 443")).toBe("213662774443");
  });

  it("keeps an international number without the plus sign", () => {
    expect(normalizeContactNumber("+213 662 774 443")).toBe("213662774443");
  });
});
