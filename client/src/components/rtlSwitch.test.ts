import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * RTL regression guard: in an Arabic (dir="rtl") layout the switch thumb must
 * move to the inline END when enabled. The shared Switch previously used a
 * positive translate-x only, so the knob moved right instead of left.
 */
const switchSource = readFileSync("client/src/components/ui/switch.tsx", "utf8");
const html = readFileSync("client/index.html", "utf8");

describe("switch direction in RTL", () => {
  it("documents the app as RTL", () => {
    expect(html).toMatch(/dir="rtl"/);
  });

  it("mirrors the checked translation for RTL", () => {
    expect(switchSource).toContain("rtl:data-[state=checked]:-translate-x-");
    expect(switchSource).toContain("data-[state=checked]:translate-x-[calc(100%-2px)]");
  });
});

describe("no reversed custom toggles", () => {
  it("uses logical margins/positions for knob movement", () => {
    const files = [
      "client/src/storefront/editor/SectionSettingsDialog.tsx",
      "client/src/pages/Categories.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // physical right/left margins on a knob are what caused the reversal
      expect(source, file).not.toMatch(/mr-0\.5|mr-\[2[0-9]px\]/);
    }
  });
});
