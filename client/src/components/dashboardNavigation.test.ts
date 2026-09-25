import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The dashboard sidebar renders from `navigationGroups` (grouped paths), NOT
 * from `dashboardNavigation` directly. A nav entry that is missing from every
 * group is therefore invisible — which is exactly what happened with
 * «الفئات»: the page worked but the sidebar item never rendered.
 */
const source = readFileSync(
  "client/src/components/DashboardLayout.tsx",
  "utf8"
);

const navPaths = [...source.matchAll(/path:\s*"(\/[a-z0-9-]+)"/g)].map(
  match => match[1]
);

const groupedPaths = [...source.matchAll(/paths:\s*\[([^\]]+)\]/g)].flatMap(
  match => [...match[1].matchAll(/"(\/[a-z0-9-]+)"/g)].map(inner => inner[1])
);

describe("dashboard sidebar navigation", () => {
  it("lists every nav entry inside a group (otherwise it never renders)", () => {
    const orphans = navPaths.filter(path => !groupedPaths.includes(path));
    expect(orphans, `مسارات بلا مجموعة: ${orphans.join(", ")}`).toEqual([]);
  });

  it("has a nav entry for every grouped path (otherwise the link renders nothing)", () => {
    // The sidebar renders `dashboardNavigation.find(entry => entry.path === p)`
    // for each grouped path, so a grouped path WITHOUT a nav entry silently
    // disappears — exactly how "العروض" went missing.
    const missing = groupedPaths.filter(path => !navPaths.includes(path));
    expect(missing, `مسارات بلا عنصر في القائمة: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the categories and offers entries grouped next to products", () => {
    const productsGroup = source.match(
      /title:\s*"الكتالوج والتوصيل",\s*paths:\s*\[([^\]]+)\]/
    );
    expect(productsGroup?.[1]).toContain('"/products"');
    expect(productsGroup?.[1]).toContain('"/categories"');
    expect(productsGroup?.[1]).toContain('"/offers"');
  });

  it("has a route registered for every nav path", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    for (const path of navPaths) {
      expect(app.includes(`path="${path}"`), `لا راوت لـ ${path}`).toBe(true);
    }
  });
});
