/* @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMMON_STYLE_FIELDS,
  SECTION_FIELDS,
  visibleSectionFields,
  type SectionField,
} from "@shared/storefront/sectionFields";
import {
  STOREFRONT_TEMPLATE_KEYS,
  TEMPLATE_DEFAULT_CONFIGS,
  type StorefrontSectionType,
} from "@shared/storefront/storefrontConfig";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: {
      uploadAsset: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(cleanup);

const ALL_TYPES: StorefrontSectionType[] = [
  "announcement",
  "header",
  "hero",
  "categories",
  "featured_products",
  "product_grid",
  "promo",
  "benefits",
  "testimonials",
  "newsletter",
  "signature",
  "footer",
];

const byKey = (fields: SectionField[], key: string) =>
  fields.find(field => field.key === key) as SectionField;

describe("conditional fields (one rule applied everywhere)", () => {
  it("hides the gradient controls unless the background type is gradient", () => {
    const fields = () => [...SECTION_FIELDS.announcement, ...COMMON_STYLE_FIELDS];

    const defaultKeys = visibleSectionFields("announcement", fields(), {}).map(f => f.key);
    expect(defaultKeys).toContain("styleBg");
    expect(defaultKeys).not.toContain("styleGradientFrom");
    expect(defaultKeys).not.toContain("styleGradientAngle");

    const gradientKeys = visibleSectionFields("announcement", fields(), {
      styleBgMode: "gradient",
    }).map(f => f.key);
    expect(gradientKeys).toContain("styleGradientFrom");
    expect(gradientKeys).toContain("styleGradientTo");
    expect(gradientKeys).toContain("styleGradientAngle");
    expect(gradientKeys).not.toContain("styleBg");

    const solidKeys = visibleSectionFields("announcement", fields(), {
      styleBgMode: "solid",
    }).map(f => f.key);
    expect(solidKeys).toContain("styleBg");
    expect(solidKeys).not.toContain("styleGradientTo");
  });

  it("keeps a legacy background color editable when no mode is stored", () => {
    const keys = visibleSectionFields("announcement", COMMON_STYLE_FIELDS, {
      styleBg: "#101010",
    }).map(f => f.key);
    expect(keys).toContain("styleBg");
  });

  it("never shows two font pickers on the signature", () => {
    const signatureKeys = visibleSectionFields(
      "signature",
      [...SECTION_FIELDS.signature, ...COMMON_STYLE_FIELDS],
      {}
    ).map(f => f.key);
    expect(signatureKeys).toContain("font");
    expect(signatureKeys).not.toContain("styleFont");

    const heroKeys = visibleSectionFields(
      "hero",
      [...SECTION_FIELDS.hero, ...COMMON_STYLE_FIELDS],
      {}
    ).map(f => f.key);
    expect(heroKeys).toContain("styleFont");
  });

  it("declares the rule on the field itself (generic, not per-section code)", () => {
    expect(byKey(COMMON_STYLE_FIELDS, "styleGradientFrom").showWhen).toEqual({
      key: "styleBgMode",
      in: ["gradient"],
    });
    expect(byKey(COMMON_STYLE_FIELDS, "styleBg").showWhen?.in).toEqual(["", "solid"]);
    expect(byKey(COMMON_STYLE_FIELDS, "styleFont").hideFor).toEqual(["signature"]);
  });
});

describe("no duplicated control can slip in", () => {
  it("never offers an empty option inside a field's own options", () => {
    for (const field of COMMON_STYLE_FIELDS) {
      expect((field.options ?? []).map(o => o.value), field.key).not.toContain("");
      const labels = (field.options ?? []).map(o => o.label);
      expect(new Set(labels).size, field.key).toBe(labels.length);
    }
  });

  it("has unique keys per section (content + overrides combined)", () => {
    for (const type of ALL_TYPES) {
      const keys = visibleSectionFields(
        type,
        [...SECTION_FIELDS[type], ...COMMON_STYLE_FIELDS],
        {}
      ).map(field => field.key);
      expect(new Set(keys).size, `${type}: ${keys.join(",")}`).toBe(keys.length);
    }
  });

  it("keeps the old duplicated checkbox toggle out of the dialog", () => {
    const source = readFileSync(
      "client/src/storefront/editor/SectionSettingsDialog.tsx",
      "utf8"
    );
    expect(source).not.toContain("DefaultToggle");
    expect(source).toContain("افتراضي القالب");
  });
});

describe("template colors never fight the tokens (real CSS specificity bug)", () => {
  const templates = [
    "ModernStorefront.tsx",
    "MinimalStorefront.tsx",
    "BoldStorefront.tsx",
    "BoutiqueStorefront.tsx",
  ];

  it("does not put a literal text color next to a token text color", () => {
    for (const file of templates) {
      const source = readFileSync(`client/src/storefront/${file}`, "utf8");
      for (const line of source.split("\n")) {
        const hasLiteral = /text-(white|black)\b|text-\[#[0-9A-Fa-f]{3,8}\]/.test(line);
        const hasToken = /text-\[var\(--sf-color-/.test(line);
        // A line may render both only if the literal is inside a placeholder:.
        if (hasLiteral && hasToken) {
          expect(
            line.includes("placeholder:"),
            `${file}: ${line.trim().slice(0, 120)}`
          ).toBe(true);
        }
      }
    }
  });
});

describe("editable defaults shipped for every template", () => {
  it("gives the announcement a secondary line", () => {
    expect(SECTION_FIELDS.announcement.map(f => f.key)).toEqual([
      "text",
      "subtitle",
    ]);
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const announcement = TEMPLATE_DEFAULT_CONFIGS[key].sections.find(
        s => s.type === "announcement"
      );
      expect(announcement?.settings.subtitle, key).toBeTruthy();
    }
  });

  it("ships the four benefit cards as editable items", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const benefits = TEMPLATE_DEFAULT_CONFIGS[key].sections.find(
        s => s.type === "benefits"
      );
      expect(benefits?.items?.length, key).toBe(4);
      for (const item of benefits?.items ?? []) {
        expect(item.text, `${key}/${item.id}`).toBeTruthy();
        expect(item.icon, `${key}/${item.id}`).toBeTruthy();
      }
    }
  });

  it("ships the four category tiles as editable items", () => {
    for (const key of STOREFRONT_TEMPLATE_KEYS) {
      const categories = TEMPLATE_DEFAULT_CONFIGS[key].sections.find(
        s => s.type === "categories"
      );
      expect(categories?.items?.length, key).toBe(4);
    }
  });
});
