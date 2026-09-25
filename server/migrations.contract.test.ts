import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A UTF-8 BOM at the start of a migration file makes `drizzle-kit migrate`
 * exit with code 1 and NO message at all (the first statement becomes
 * "\uFEFFALTER TABLE ..."). That cost us a silent failure once, so every
 * migration must be BOM-free.
 *
 * Hand-written files must therefore be saved as plain UTF-8 (the editor tools
 * used here do that; PowerShell's `Set-Content -Encoding UTF8` in PS 5.1 does
 * NOT — it adds a BOM).
 */
const MIGRATIONS_DIR = "drizzle";

const sqlFiles = readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith(".sql"));

describe("migration files are BOM-free", () => {
  it("finds the migration files", () => {
    expect(sqlFiles.length).toBeGreaterThan(0);
  });

  it.each(sqlFiles)("%s starts with plain UTF-8 (no BOM)", file => {
    const bytes = readFileSync(join(MIGRATIONS_DIR, file));
    const hasBom =
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    expect(hasBom, `${file} starts with a UTF-8 BOM`).toBe(false);
  });
});
