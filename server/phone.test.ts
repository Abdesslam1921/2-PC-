import { describe, expect, it } from "vitest";
import {
  ALGERIAN_MOBILE_PATTERN,
  normalizeAlgerianMobile,
} from "./phone";

describe("normalizeAlgerianMobile", () => {
  it("keeps an already-valid local number", () => {
    expect(normalizeAlgerianMobile("0555123456")).toBe("0555123456");
    expect(normalizeAlgerianMobile("0661234567")).toBe("0661234567");
    expect(normalizeAlgerianMobile("0771234567")).toBe("0771234567");
  });

  it("strips spaces, dashes, dots and parentheses", () => {
    expect(normalizeAlgerianMobile("0555 12 34 56")).toBe("0555123456");
    expect(normalizeAlgerianMobile("0555-12-34-56")).toBe("0555123456");
    expect(normalizeAlgerianMobile("(0555) 12.34.56")).toBe("0555123456");
  });

  it("accepts +213 / 00213 / 213 country prefixes", () => {
    expect(normalizeAlgerianMobile("+213555123456")).toBe("0555123456");
    expect(normalizeAlgerianMobile("00213555123456")).toBe("0555123456");
    expect(normalizeAlgerianMobile("213555123456")).toBe("0555123456");
    expect(normalizeAlgerianMobile("+213 555 123 456")).toBe("0555123456");
  });

  it("accepts a bare 9-digit national number", () => {
    expect(normalizeAlgerianMobile("555123456")).toBe("0555123456");
  });

  it("rejects non-mobile / malformed numbers", () => {
    for (const bad of [
      "0212345678",
      "05500",
      "05551234567",
      "55512345",
      "",
      "abc",
      "+213021234567",
      null,
      undefined,
    ]) {
      expect(normalizeAlgerianMobile(bad as string)).toBeNull();
    }
  });

  it("exposes the canonical pattern used across the app", () => {
    expect(ALGERIAN_MOBILE_PATTERN.test("0555123456")).toBe(true);
    expect(ALGERIAN_MOBILE_PATTERN.test("1555123456")).toBe(false);
  });
});
