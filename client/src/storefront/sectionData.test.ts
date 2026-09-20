import { describe, expect, it } from "vitest";
import { benefitRows, categoryTiles, footerData, phoneHref, whatsappHref } from "./sectionData";
import { signatureStyle } from "./FooterExtras";
import { SECTION_FIELDS } from "@shared/storefront/sectionFields";
import { storefrontAnchors } from "./sectionIcons";
import type { StorefrontSection } from "@shared/storefront/storefrontConfig";

const section = (
  type: StorefrontSection["type"],
  settings: StorefrontSection["settings"] = {},
  items?: StorefrontSection["items"]
): StorefrontSection => ({ id: type, type, enabled: true, order: 0, settings, items });

describe("per-item editing data", () => {
  it("uses merchant benefit items when present (each one editable)", () => {
    const rows = benefitRows(
      section("benefits", {}, [
        { id: "b1", name: "توصيل سريع", text: "24 ساعة", icon: "truck", bg: "#111111" },
      ]),
      [["01", "افتراضي", "نص افتراضي"]]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "توصيل سريع",
      text: "24 ساعة",
      icon: "truck",
      bg: "#111111",
      num: "01",
    });
  });

  it("falls back to the template defaults when there are no items", () => {
    const rows = benefitRows(section("benefits"), [["01", "أ", "ب"]]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("أ");
    expect(rows[0].bg).toBeUndefined();
  });

  it("uses per-category name/image/background, else live collections", () => {
    const custom = categoryTiles(
      section("categories", {}, [
        { id: "c1", name: "مجوهرات", imageUrl: "/j.jpg", bg: "#123456" },
      ]),
      ["ملابس"]
    );
    expect(custom[0]).toEqual({
      id: "c1",
      name: "مجوهرات",
      imageUrl: "/j.jpg",
      bg: "#123456",
    });
    const auto = categoryTiles(section("categories"), ["ملابس", "عناية"]);
    expect(auto.map(t => t.name)).toEqual(["ملابس", "عناية"]);
    expect(auto[0].bg).toBeUndefined();
  });
});

describe("footer editable fields", () => {
  it("exposes help answers, phone and social links with link hrefs", () => {
    const data = footerData(
      section("footer", {
        about: "متجرنا",
        trackOrder: "اتصل بالدعم",
        returns: "خلال 7 أيام",
        phone: "0555 12 34 56",
        facebook: "https://facebook.com/x",
        instagram: "https://instagram.com/x",
        whatsapp: "0555 99 88 77",
      }),
      { products: "#sf-sec-grid", categories: "#sf-sec-cats" }
    );
    expect(data.about).toBe("متجرنا");
    expect(data.trackOrder).toBe("اتصل بالدعم");
    expect(data.returns).toBe("خلال 7 أيام");
    expect(data.productsHref).toBe("#sf-sec-grid");
    expect(data.categoriesHref).toBe("#sf-sec-cats");
    expect(phoneHref(data.phone)).toBe("tel:0555123456");
    expect(whatsappHref(data.whatsapp)).toBe("https://wa.me/0555998877");
  });

  it("returns empty hrefs when no phone/whatsapp is configured", () => {
    expect(phoneHref("")).toBe("");
    expect(whatsappHref("")).toBe("");
  });
});

describe("footer link destinations", () => {
  it("points new/categories links at the matching sections", () => {
    const config = {
      templateKey: "modern" as const,
      sections: [
        { id: "cats", type: "categories" as const, enabled: true, order: 0, settings: {} },
        { id: "grid1", type: "product_grid" as const, enabled: true, order: 1, settings: {} },
      ],
    };
    expect(storefrontAnchors(config)).toEqual({
      products: "#sf-sec-grid1",
      categories: "#sf-sec-cats",
      hasCategories: true,
    });
  });

  it("ignores disabled sections and falls back safely", () => {
    const config = {
      templateKey: "minimal" as const,
      sections: [
        { id: "grid1", type: "product_grid" as const, enabled: false, order: 0, settings: {} },
      ],
    };
    expect(storefrontAnchors(config)).toEqual({
      products: "#top",
      categories: "#top",
      hasCategories: false,
    });
  });
});

describe("signature section", () => {
  it("keeps the color field editable (regression: it went missing)", () => {
    const color = SECTION_FIELDS.signature.find(field => field.key === "color");
    expect(color?.type).toBe("color");
    expect(SECTION_FIELDS.signature.map(field => field.key)).toEqual([
      "text",
      "subtitle",
      "font",
      "color",
      "showOrnament",
    ]);
  });

  it("shows the decorative flourish by default and allows hiding it", () => {
    expect(signatureStyle(section("signature", { text: "المتجر" })).showOrnament).toBe(
      true
    );
    expect(
      signatureStyle(section("signature", { showOrnament: false })).showOrnament
    ).toBe(false);
  });

  it("follows the theme text color and heading font by default", () => {
    const sig = signatureStyle(section("signature", { text: "المتجر" }));
    expect(sig.text).toBe("المتجر");
    expect(sig.style.color).toContain("var(--sf-color-text");
    expect(sig.style.fontFamily).toContain("var(--sf-font-heading");
  });

  it("uses an explicit color and font when chosen", () => {
    const sig = signatureStyle(
      section("signature", { color: "#941f0a", font: "serif" })
    );
    expect(sig.style.color).toBe("#941f0a");
    expect(sig.style.fontFamily).toContain("Georgia");
  });

  it("supports the Great Vibes signature font", () => {
    const sig = signatureStyle(section("signature", { font: "greatvibes" }));
    expect(sig.style.fontFamily).toContain("Great Vibes");
  });
});
