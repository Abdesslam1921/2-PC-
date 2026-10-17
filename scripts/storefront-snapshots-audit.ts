/**
 * READ-ONLY audit of storefront snapshots against the CURRENT validator.
 *
 * Reports, for the real database:
 *   - every store's CURRENT PUBLISHED snapshot (latest version): strict-valid,
 *     valid-after-normalization, or still invalid + reason,
 *   - whether the stored snapshot needed normalization and exactly which
 *     key/section/reason the normalizer dropped,
 *   - every HISTORICAL version (rollback targets) with the same information,
 *   - grouped summaries so removed/renamed fields are visible instead of
 *     being silently dropped at read time.
 *
 * It writes NOTHING (only SELECTs). Safe to run at any time.
 *
 * RUN THIS BEFORE ANY DEPLOY THAT CHANGES THE STOREFRONT CONFIG SCHEMA.
 *
 * Usage:  pnpm exec tsx scripts/storefront-snapshots-audit.ts
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import {
  validateStoredStorefrontConfig,
  validateStorefrontConfig,
} from "../shared/storefront/storefrontConfig";
import type { StorefrontNormalizationDrop } from "../shared/storefront/normalization";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const conn = await createConnection(url);

interface AuditResult {
  strictValid: boolean;
  storedValid: boolean;
  message: string | null;
  drops: StorefrontNormalizationDrop[];
}

const audit = (snapshotJson: string): AuditResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    return {
      strictValid: false,
      storedValid: false,
      message: "JSON غير قابل للتحليل (corrupt)",
      drops: [],
    };
  }
  const strict = validateStorefrontConfig(parsed);
  const drops: StorefrontNormalizationDrop[] = [];
  const stored = validateStoredStorefrontConfig(parsed, drops);
  return {
    strictValid: strict.ok,
    storedValid: stored.ok,
    message: stored.ok ? null : stored.message ?? "غير معروف",
    drops,
  };
};

try {
  const [stores]: any = await conn.query(
    "SELECT DISTINCT storeId FROM storefront_versions ORDER BY storeId"
  );
  console.log(`stores with versions: ${stores.length}`);

  let currentStrictValid = 0;
  let currentNeedsNormalization = 0;
  let currentInvalid = 0;
  let historyStrictValid = 0;
  let historyNeedsNormalization = 0;
  let historyInvalid = 0;
  const reasonsCurrent = new Map<string, number>();
  const reasonsHistory = new Map<string, number>();
  const dropReasons = new Map<string, number>();
  const dropExamples: string[] = [];
  const examples: string[] = [];

  for (const { storeId } of stores) {
    const [versions]: any = await conn.query(
      `SELECT versionNumber, snapshotJson FROM storefront_versions
        WHERE storeId = ? ORDER BY versionNumber`,
      [storeId]
    );
    const latest = versions[versions.length - 1];
    const current = audit(latest.snapshotJson);
    if (current.strictValid) currentStrictValid += 1;
    else if (current.storedValid) currentNeedsNormalization += 1;
    else {
      currentInvalid += 1;
      const key = (current.message ?? "غير معروف").split("\n")[0].slice(0, 160);
      reasonsCurrent.set(key, (reasonsCurrent.get(key) ?? 0) + 1);
      examples.push(`store ${storeId} v${latest.versionNumber}: ${key}`);
    }
    for (const drop of current.drops) {
      const key = `${drop.reason} · ${drop.section ?? "-"} · ${drop.key}`;
      dropReasons.set(key, (dropReasons.get(key) ?? 0) + 1);
      if (dropExamples.length < 20) {
        dropExamples.push(
          `store ${storeId} v${latest.versionNumber} · ${drop.path} · key=${drop.key} · section=${drop.section ?? "-"} · ${drop.reason}${drop.detail ? ` (${drop.detail})` : ""}`
        );
      }
    }

    for (const v of versions) {
      const result = audit(v.snapshotJson);
      if (result.strictValid) historyStrictValid += 1;
      else if (result.storedValid) historyNeedsNormalization += 1;
      else {
        historyInvalid += 1;
        const key = (result.message ?? "غير معروف").split("\n")[0].slice(0, 160);
        reasonsHistory.set(key, (reasonsHistory.get(key) ?? 0) + 1);
      }
    }
  }

  console.log("\n=== CURRENT PUBLISHED (latest per store) ===");
  console.log(
    `strict-valid: ${currentStrictValid} · valid-after-normalization: ${currentNeedsNormalization} · still-invalid: ${currentInvalid}`
  );
  for (const [r, n] of reasonsCurrent) console.log(`  [${n}] ${r}`);

  console.log("\n=== ALL VERSIONS (history + current) ===");
  console.log(
    `strict-valid: ${historyStrictValid} · valid-after-normalization: ${historyNeedsNormalization} · still-invalid: ${historyInvalid}`
  );
  for (const [r, n] of reasonsHistory) console.log(`  [${n}] ${r}`);

  console.log("\n=== NORMALIZATION DROPS (current published) ===");
  if (dropReasons.size === 0) {
    console.log("none — every current snapshot matches the strict schema.");
  } else {
    for (const [r, n] of dropReasons) console.log(`  [${n}] ${r}`);
    console.log("\n=== DROP EXAMPLES (key / section / reason) ===");
    for (const e of dropExamples) console.log("  " + e);
  }

  if (examples.length) {
    console.log("\n=== CURRENT INVALID EXAMPLES (still invalid after normalization) ===");
    for (const e of examples.slice(0, 20)) console.log("  " + e);
  }
} finally {
  await conn.end();
}
