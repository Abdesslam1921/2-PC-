import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildBundleSeo,
  buildCategorySeo,
  buildGenericSeo,
  buildProductSeo,
  buildStoreSeo,
  canonicalPath,
  escapeHtml,
  injectSeoHead,
  productAvailable,
  productPrice,
  renderRobots,
  renderSeoHead,
  renderSitemap,
  stripHtml,
  truncate,
  type SeoProduct,
} from "./seo";

const store = { name: "متجر النور", slug: "nour" };
const origin = "https://nour.abdou-store.com";

const product: SeoProduct = {
  id: 42,
  title: "حقيبة جلدية",
  description: "<p>حقيبة <b>جلدية</b> أنيقة</p>",
  price: "4500.00",
  currency: "dzd",
  inventory: 3,
  trackInventory: true,
  continueSelling: false,
  sku: "BAG-42",
  updatedAt: "2026-10-18T10:00:00.000Z",
  images: [{ url: "/manus-storage/bag.jpg", altText: "حقيبة" }],
  variants: [],
  offers: [],
};

describe("SEO text helpers", () => {
  it("escapes HTML/XML special characters", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;"
    );
  });

  it("strips markup, collapses whitespace and truncates", () => {
    expect(stripHtml(product.description)).toBe("حقيبة جلدية أنيقة");
    expect(truncate("abcdef", 5)).toBe("abcd…");
    expect(truncate("abc", 5)).toBe("abc");
  });

  it("normalises paths and absolute URLs", () => {
    expect(canonicalPath("/p/42?utm=x#top")).toBe("/p/42");
    expect(absoluteUrl(origin, "/p/42")).toBe(`${origin}/p/42`);
    expect(absoluteUrl(origin, "https://cdn.example/x.jpg")).toBe(
      "https://cdn.example/x.jpg"
    );
  });
});

describe("product SEO model", () => {
  it("builds title, canonical, image and product JSON-LD", () => {
    const model = buildProductSeo({
      store,
      origin,
      path: "/p/42?utm=fb",
      product,
    });
    expect(model.type).toBe("product");
    expect(model.title).toBe("حقيبة جلدية | متجر النور");
    expect(model.canonical).toBe(`${origin}/p/42`);
    expect(model.image).toBe(`${origin}/manus-storage/bag.jpg`);
    expect(model.description).toBe("حقيبة جلدية أنيقة");

    const ld = model.jsonLd[0] as Record<string, any>;
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("حقيبة جلدية");
    expect(ld.sku).toBe("BAG-42");
    expect(ld.offers.price).toBe("4500.00");
    expect(ld.offers.priceCurrency).toBe("DZD");
    expect(ld.offers.availability).toBe("https://schema.org/InStock");
    const breadcrumb = model.jsonLd[1] as Record<string, any>;
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(breadcrumb.itemListElement).toHaveLength(2);
  });

  it("marks out-of-stock and falls back to a variant price", () => {
    const out = {
      ...product,
      price: null,
      inventory: 0,
      variants: [{ price: "3900.00", stock: 0, available: false }],
    };
    expect(productAvailable(out)).toBe(false);
    expect(productPrice(out)).toBe("3900.00");
    const model = buildProductSeo({
      store,
      origin,
      path: "/p/42",
      product: out,
    });
    const ld = model.jsonLd[0] as Record<string, any>;
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("treats continueSelling/untracked products as available", () => {
    expect(
      productAvailable({ ...product, inventory: 0, continueSelling: true })
    ).toBe(true);
    expect(
      productAvailable({
        ...product,
        inventory: 0,
        trackInventory: false,
      })
    ).toBe(true);
  });

  it("omits the Offer node when no price is known", () => {
    const model = buildProductSeo({
      store,
      origin,
      path: "/p/42",
      product: {
        ...product,
        price: null,
        variants: [],
        offers: [],
      },
    });
    const ld = model.jsonLd[0] as Record<string, any>;
    expect(ld.offers).toBeUndefined();
  });

  it("never emits an unescaped closing script tag in JSON-LD", () => {
    const model = buildProductSeo({
      store,
      origin,
      path: "/p/42",
      product: {
        ...product,
        title: "</script><script>alert(1)</script>",
        description: "safe",
      },
    });
    const html = renderSeoHead(model);
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script\\u003e");
  });
});

describe("store/generic SEO + injection", () => {
  it("builds store and generic models", () => {
    const storeModel = buildStoreSeo({ store, origin, path: "/store" });
    expect(storeModel.canonical).toBe(`${origin}/`);
    expect(storeModel.title).toBe(store.name);
    const generic = buildGenericSeo({ origin, path: "/" });
    expect(generic.title).toBe("عبده ستور");
  });

  it("replaces the template title and keeps exactly one SEO block", () => {
    const html =
      "<html><head><title>old</title></head><body><div id='root'></div></body></html>";
    const model = buildStoreSeo({ store, origin, path: "/" });
    const once = injectSeoHead(html, model);
    const twice = injectSeoHead(once, model);
    expect(once).not.toContain("<title>old</title>");
    expect(once.match(/<!-- seo:start -->/g)).toHaveLength(1);
    expect(twice.match(/<!-- seo:start -->/g)).toHaveLength(1);
    expect(twice.match(/<title>/g)).toHaveLength(1);
    expect(twice).toContain(`<link rel="canonical" href="${origin}/">`);
  });

  it("leaves HTML without a head unchanged", () => {
    const model = buildStoreSeo({ store, origin, path: "/" });
    expect(injectSeoHead("<div>fragment</div>", model)).toBe(
      "<div>fragment</div>"
    );
  });
});

describe("bundle SEO model", () => {
  const bundle = {
    name: "باقة الشتاء",
    slug: "winter",
    imageUrl: null,
    pricing: { bundlePrice: 9000, originalTotal: 10000, freeDelivery: true },
    items: [
      { title: "حقيبة", quantity: 1, imageUrl: "/bag.jpg", currency: "dzd" },
      { title: "وشاح", quantity: 2, imageUrl: "/scarf.jpg", currency: "dzd" },
    ],
  };

  it("builds a Product + Breadcrumb from the computed bundle price", () => {
    const model = buildBundleSeo({
      store,
      origin,
      path: "/b/winter?utm=fb",
      bundle,
    });
    expect(model.title).toBe("باقة الشتاء | متجر النور");
    expect(model.canonical).toBe(`${origin}/b/winter`);
    expect(model.image).toBe(`${origin}/bag.jpg`);
    expect(model.description).toContain("9000.00 DZD");
    expect(model.description).toContain("توصيل مجاني");

    const [productLd, breadcrumbLd] = model.jsonLd as Record<string, any>[];
    expect(productLd["@type"]).toBe("Product");
    expect(productLd.offers.price).toBe("9000.00");
    expect(productLd.offers.priceCurrency).toBe("DZD");
    expect(productLd.offers.availability).toBe("https://schema.org/InStock");
    expect(productLd.url).toBe(`${origin}/b/winter`);
    expect(breadcrumbLd["@type"]).toBe("BreadcrumbList");
  });

  it("prefers the bundle image and omits the offer when no price exists", () => {
    const model = buildBundleSeo({
      store,
      origin,
      path: "/b/winter",
      bundle: {
        ...bundle,
        imageUrl: "/bundle.jpg",
        pricing: { bundlePrice: 0, originalTotal: 0, freeDelivery: false },
      },
    });
    expect(model.image).toBe(`${origin}/bundle.jpg`);
    expect((model.jsonLd[0] as Record<string, any>).offers).toBeUndefined();
  });

  it("escapes merchant text inside the head and JSON-LD", () => {
    const model = buildBundleSeo({
      store,
      origin,
      path: "/b/winter",
      bundle: {
        ...bundle,
        name: `باقة </script><script>alert(1)</script>`,
      },
    });
    const head = renderSeoHead(model);
    expect(head).not.toContain("</script><script>");
    expect(head.match(/<\/script>/g)).toHaveLength(2);
  });
});

describe("category SEO model", () => {
  const categoryPage = {
    category: { name: "حقائب", slug: "bags", imageUrl: "/category.jpg" },
    products: [
      {
        id: 7,
        title: "حقيبة جلدية",
        price: "4500.00",
        images: [{ url: "/bag.jpg" }],
      },
      { id: 8, title: "حقيبة قماش", price: "2500.00", images: [] },
    ],
  };

  it("builds CollectionPage + ItemList + Breadcrumb", () => {
    const model = buildCategorySeo({
      store,
      origin,
      path: "/store/category/bags",
      categoryPage,
    });
    expect(model.title).toBe("حقائب | متجر النور");
    expect(model.canonical).toBe(`${origin}/store/category/bags`);
    expect(model.image).toBe(`${origin}/category.jpg`);
    expect(model.jsonLd.map(entry => (entry as any)["@type"])).toEqual([
      "CollectionPage",
      "ItemList",
      "BreadcrumbList",
    ]);
    const list = model.jsonLd[1] as Record<string, any>;
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement[0].url).toBe(`${origin}/p/7`);
    expect(list.itemListElement[1].name).toBe("حقيبة قماش");
  });

  it("falls back to the first product image", () => {
    const model = buildCategorySeo({
      store,
      origin,
      path: "/store/category/bags",
      categoryPage: {
        ...categoryPage,
        category: { ...categoryPage.category, imageUrl: null },
      },
    });
    expect(model.image).toBe(`${origin}/bag.jpg`);
  });
});

describe("robots/sitemap", () => {
  it("emits a sitemap with home + products and escaped URLs", () => {
    const xml = renderSitemap({
      store,
      origin,
      products: [
        { id: 42, updatedAt: "2026-10-18T10:00:00.000Z" },
        { id: 43, updatedAt: null },
      ],
    });
    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain(`${origin}/</loc>`);
    expect(xml).toContain(`${origin}/p/42</loc>`);
    expect(xml).toContain(`<lastmod>2026-10-18T10:00:00.000Z</lastmod>`);
    expect(xml.match(/<url>/g)).toHaveLength(3);
  });

  it("includes bundles and categories with lastmod", () => {
    const xml = renderSitemap({
      store,
      origin,
      products: [{ id: 42, updatedAt: "2026-10-18T10:00:00.000Z" }],
      bundles: [{ slug: "winter", updatedAt: "2026-10-19T10:00:00.000Z" }],
      categories: [{ slug: "bags", updatedAt: "2026-10-20T10:00:00.000Z" }],
    });
    expect(xml).toContain(`${origin}/b/winter</loc>`);
    expect(xml).toContain(`${origin}/store/category/bags</loc>`);
    expect(xml).toContain(`<lastmod>2026-10-19T10:00:00.000Z</lastmod>`);
    expect(xml).toContain(`<lastmod>2026-10-20T10:00:00.000Z</lastmod>`);
    expect(xml.match(/<url>/g)).toHaveLength(4);
  });

  it("adds the sitemap to robots only when a store is resolved", () => {
    expect(renderRobots({ store, origin })).toContain(
      `Sitemap: ${origin}/sitemap.xml`
    );
    expect(renderRobots({ store: null, origin })).not.toContain("Sitemap:");
    expect(renderRobots({ store, origin })).toContain("Disallow: /dashboard");
  });
});
