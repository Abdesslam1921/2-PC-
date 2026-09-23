import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Hybrid many-to-many invariants.
 *
 * Membership of a category is the union of the product's PRIMARY category and
 * its `product_categories` rows. Every read/count/delete path must keep using
 * that union — a regression to `categoryId` only would silently hide the extra
 * memberships (this is exactly the class of bug the feature was about).
 */
const db = readFileSync("server/db.ts", "utf8");

const functionBody = (name: string) => {
  const start = db.indexOf(`export async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  // crude but stable: until the next top-level export
  const rest = db.slice(start);
  const next = rest.indexOf("\nexport ", 10);
  return next > 0 ? rest.slice(0, next) : rest;
};

describe("category membership uses the union everywhere", () => {
  it("public category list counts primary OR junction members", () => {
    const body = functionBody("listPublicCategories");
    expect(body).toContain("product_categories");
    expect(body).toContain("EXISTS");
  });

  it("public product list of a category uses the union", () => {
    const body = functionBody("listPublicProductsByCategory");
    expect(body).toContain("product_categories");
    expect(body).toContain("or(");
  });

  it("dashboard counts use the union", () => {
    const body = functionBody("listCategoriesWithCounts");
    expect(body).toContain("product_categories");
    expect(body).toContain("activeProductCount");
  });

  it("the delete guard counts union members too", () => {
    const body = functionBody("countCategoryProducts");
    expect(body).toContain("product_categories");
  });

  it("deleting a category clears junction rows and primary links", () => {
    const body = functionBody("deleteCategory");
    expect(body).toContain("delete(productCategories)");
    expect(body).toContain("categoryId: null");
    expect(body).toContain("delete(categories)");
  });

  it("setting a category's products never steals another primary", () => {
    const body = functionBody("setCategoryProducts");
    // adds membership rows for products whose primary differs …
    expect(body).toContain("insert(productCategories)");
    expect(body).toContain("row.primary !== input.categoryId");
    // … and only clears the primary for products no longer selected
    expect(body).toContain("not(selected)");
  });

  it("the migration ships the junction table and the backfill", () => {
    const migration = readFileSync("drizzle/0064_calm_lorna_dane.sql", "utf8");
    expect(migration).toContain("CREATE TABLE `product_categories`");
    expect(migration).toContain("product_categories_product_category_unique");
    expect(migration).toContain("INSERT IGNORE INTO `product_categories`");
  });
});
