import { describe, expect, it } from "vitest";
import {
  addOptionValue,
  buildVariantDrafts,
  formatVariantLabel,
  removeOptionValue,
} from "./productDraft";

describe("product variant draft helpers", () => {
  it("creates every color and size combination with the base price", () => {
    const variants = buildVariantDrafts(["أسود", "أبيض"], ["S", "M"], "3200");
    expect(variants).toHaveLength(4);
    expect(variants.map(formatVariantLabel)).toEqual([
      "أسود · S",
      "أسود · M",
      "أبيض · S",
      "أبيض · M",
    ]);
    expect(
      variants.every(
        variant =>
          variant.price === "3200" &&
          variant.stock === "0" &&
          variant.lowStockThreshold === "5"
      )
    ).toBe(true);
  });

  it("keeps a usable default variant when no option values are supplied", () => {
    const [variant] = buildVariantDrafts([], [], "1500");
    expect(variant).toMatchObject({ price: "1500", available: true });
    expect(formatVariantLabel(variant)).toBe("الخيار الافتراضي");
  });

  it("adds unique option values and removes existing values without mutating the original array", () => {
    const colors = ["أسود", "أبيض"];
    expect(addOptionValue(colors, "أزرق")).toEqual(["أسود", "أبيض", "أزرق"]);
    expect(addOptionValue(colors, " أسود ")).toBe(colors);
    expect(removeOptionValue(colors, "أبيض")).toEqual(["أسود"]);
    expect(colors).toEqual(["أسود", "أبيض"]);
  });
});
