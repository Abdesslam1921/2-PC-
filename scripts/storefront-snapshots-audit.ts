/**
 * READ-ONLY audit of storefront snapshots against the CURRENT strict validator.
 *
 * Reports, for the real database:
 *   - every store's CURRENT PUBLISHED snapshot (latest version): valid / invalid + reason,
 *   - every HISTORICAL version (rollback targets): valid / invalid + reason,
 *   - a grouped summary of failure reasons so old snapshots that fail because of
 *     removed/renamed fields can be normalised instead of falling back blindly.
 *
 * It writes NOTHING (only SELECTs). Safe to run at any time.
 *
 * Usage:  pnpm exec tsx scripts/storefront-snapshots-audit.ts
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { validateStorefrontConfig } from "../shared/storefront/storefrontConfig";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const conn = await createConnection(url);

const reason = (snapshotJson: string): string | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    return "JSON غير قابل للتحليل (corrupt)";
  }
  const valid = validateStorefrontConfig(parsed);
  return valid.ok ? null : (valid.message ?? "غير معروف");
};

try {
  const [stores]: any = await conn.query(
    "SELECT DISTINCT storeId FROM storefront_versions ORDER BY storeId"
  );
  console.log(`stores with versions: ${stores.length}`);

  let currentValid = 0;
  let currentInvalid = 0;
  let historyValid = 0;
  let historyInvalid = 0;
  const reasonsCurrent = new Map<string, number>();
  const reasonsHistory = new Map<string, number>();
  const examples: string[] = [];

  for (const { storeId } of stores) {
    const [versions]: any = await conn.query(
      `SELECT versionNumber, snapshotJson FROM storefront_versions
        WHERE storeId = ? ORDER BY versionNumber`,
      [storeId]
    );
    const latest = versions[versions.length - 1];
    const currentReason = reason(latest.snapshotJson);
    if (currentReason === null) {
      currentValid += 1;
    } else {
      currentInvalid += 1;
      const key = currentReason.split("\n")[0].slice(0, 160);
      reasonsCurrent.set(key, (reasonsCurrent.get(key) ?? 0) + 1);
      examples.push(`store ${storeId} v${latest.versionNumber}: ${key}`);
    }

    for (const v of versions) {
      const r = reason(v.snapshotJson);
      if (r === null) {
        historyValid += 1;
      } else {
        historyInvalid += 1;
        const key = r.split("\n")[0].slice(0, 160);
        reasonsHistory.set(key, (reasonsHistory.get(key) ?? 0) + 1);
      }
    }
  }

  console.log("\n=== CURRENT PUBLISHED (latest per store) ===");
  console.log(`valid: ${currentValid} · invalid: ${currentInvalid}`);
  for (const [r, n] of reasonsCurrent) console.log(`  [${n}] ${r}`);

  console.log("\n=== ALL VERSIONS (history + current) ===");
  console.log(`valid: ${historyValid} · invalid: ${historyInvalid}`);
  for (const [r, n] of reasonsHistory) console.log(`  [${n}] ${r}`);

  if (examples.length) {
    console.log("\n=== CURRENT INVALID EXAMPLES ===");
    for (const e of examples.slice(0, 20)) console.log("  " + e);
  }
} finally {
  await conn.end();
}
