import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CLIENT_SRC = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Contract: every caller of `storefront.publish` must send the exact draft
 * version it just flushed. Publishing without `expectedDraftVersion` would let
 * a stale tab publish content the merchant never saw.
 */
describe("storefront publish contract", () => {
  const publishers = walk(CLIENT_SRC)
    .map(file => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => source.includes("storefront.publish"));

  it("covers the editor, the builder and the theme editor", () => {
    expect(
      publishers.map(({ file }) => path.basename(file)).sort()
    ).toEqual(["BuilderPage.tsx", "ThemeEditorPage.tsx", "useStoreDraft.ts"]);
  });

  it("every publish call passes expectedDraftVersion", () => {
    expect(publishers.length).toBeGreaterThan(0);
    for (const { file, source } of publishers) {
      const calls =
        source.match(
          /(?:publish|publishMutation)\.mutateAsync\(\s*\{[\s\S]*?\}\s*\)/g
        ) ?? [];
      expect(calls.length, `${path.basename(file)} has a publish call`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(
          call,
          `${path.basename(file)} must pass expectedDraftVersion`
        ).toContain("expectedDraftVersion");
      }
    }
  });
});
