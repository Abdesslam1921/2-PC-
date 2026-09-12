import { describe, expect, it } from "vitest";
import { toStoreCurrencySpend } from "./metaAdsSync";

describe("toStoreCurrencySpend", () => {
  it("converts USD ad spend into store currency with the configured rate", () => {
    expect(toStoreCurrencySpend(100, "USD", 135)).toBe(13500);
  });
  it("converts EUR ad spend with the same configured rate", () => {
    expect(toStoreCurrencySpend(80, "EUR", 135)).toBe(10800);
  });
  it("keeps spend unchanged when the ad account is already billed in DZD", () => {
    expect(toStoreCurrencySpend(2500, "dzd", 135)).toBe(2500);
  });
  it("treats an unknown currency as foreign and applies the rate", () => {
    expect(toStoreCurrencySpend(50, null, 135)).toBe(6750);
  });
});
