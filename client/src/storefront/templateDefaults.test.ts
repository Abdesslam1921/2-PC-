import { describe, expect, it } from "vitest";
import {
  STOREFRONT_TEMPLATE_KEYS,
  TEMPLATE_DEFAULT_CONFIGS,
  templateDefaultConfig,
  templateDefaultSection,
  validateStorefrontConfig,
} from "@shared/storefront/storefrontConfig";

/**
 * Section "reset" restores a section from its template default, so the lookup
 * must succeed by section id (seeded templates) AND by section type (sections
 * added by the merchant).
 */
describe("template default lookup", () => {
  it("exposes a default config for every approved template", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      expect(templateDefaultConfig(key)?.templateKey).toBe(key);
      expect(TEMPLATE_DEFAULT_CONFIGS[key]).toBeTruthy();
    }
    expect(templateDefaultConfig("legacy")).toBeNull();
    expect(templateDefaultConfig(null)).toBeNull();
  });

  it("every default config passes the strict schema", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const result = validateStorefrontConfig(TEMPLATE_DEFAULT_CONFIGS[key]);
      expect(result.ok, `${key}: ${result.message ?? ""}`).toBe(true);
    }
  });

  it("ships a categories section without preset tiles (real categories win)", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const categories = TEMPLATE_DEFAULT_CONFIGS[key].sections.find(
        section => section.type === "categories"
      );
      expect(categories, `${key} has no categories section`).toBeTruthy();
      // Shipped items used to hide every real category in the storefront.
      expect(categories?.items ?? []).toEqual([]);
    }
  });

  it("keeps section order sequential and unique per template", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const orders = TEMPLATE_DEFAULT_CONFIGS[key].sections
        .map(section => section.order)
        .sort((a, b) => a - b);
      expect(orders).toEqual(orders.map((_, index) => index));
    }
  });

  it("resolves a default section by id for every template", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const defaults = templateDefaultConfig(key);
      for (const section of defaults?.sections ?? []) {
        const found = templateDefaultSection(key, section);
        expect(found?.type, `${key}/${section.id}`).toBe(section.type);
      }
    }
  });

  it("resolves a default section by type for merchant-added sections", () => {
    const added = { id: "categories-added-1", type: "categories" };
    const found = templateDefaultSection("modern", added);
    expect(found?.type).toBe("categories");
    expect(found?.settings).toEqual(
      templateDefaultConfig("modern")?.sections.find(s => s.type === "categories")
        ?.settings
    );
    // Resetting a categories section clears custom tiles (real categories are
    // the default source again).
    expect(found?.items ?? []).toEqual([]);
  });

  it("returns null for a section type the template does not define", () => {
    expect(
      templateDefaultSection("minimal", { id: "x", type: "not_a_section" })
    ).toBeNull();
  });
});
