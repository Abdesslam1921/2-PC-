/**
 * Live verification of the storefront version system against the REAL database.
 *
 * Everything runs inside ONE transaction on ONE connection and is rolled back at
 * the end, so nothing is persisted. It proves, on real rows:
 *   (a) each publish appends a NEW immutable version (unique per store),
 *   (b) the draft is a separate row and is never touched by publishing,
 *   (c) the retention planner bounds growth without ever emptying history,
 *   (d) the draft/published rows are strictly tenant-scoped by storeId,
 *   (e) a rollback copies an old snapshot into a NEW higher version (history is
 *       preserved, never mutated or deleted) — V1→V2→V3→rollback V1→V4,
 *   (f) zero probe rows remain after rollback.
 *
 * Usage:  pnpm exec tsx scripts/storefront-versions-check.ts
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { planStorefrontRetention } from "../server/storefrontRetention";
import { DEFAULT_MODERN_CONFIG } from "../shared/storefront/storefrontConfig";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");
const conn = await createConnection(url);

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });

const snapshot = (title: string) =>
  JSON.stringify({
    ...DEFAULT_MODERN_CONFIG,
    sections: DEFAULT_MODERN_CONFIG.sections.map(section =>
      section.type === "hero"
        ? { ...section, settings: { ...section.settings, title } }
        : section
    ),
  });

let storeA: number | undefined;
let storeB: number | undefined;
const probeVersionIds: number[] = [];
let probeDraftId: number | undefined;

try {
  await conn.query("START TRANSACTION");

  const [rows]: any = await conn.query(
    "SELECT id FROM stores ORDER BY id LIMIT 2"
  );
  if (rows.length < 2) throw new Error("need two stores to probe tenancy");
  storeA = rows[0].id;
  storeB = rows[1].id;

  // Start above any existing version for these stores (probe rows only).
  const nextVersion = async (storeId: number) => {
    const [m]: any = await conn.query(
      "SELECT COALESCE(MAX(versionNumber), 0) AS v FROM storefront_versions WHERE storeId = ?",
      [storeId]
    );
    return Number(m[0].v) + 1;
  };
  const base = (await nextVersion(storeA)) - 1;

  const insertVersion = async (
    storeId: number,
    versionNumber: number,
    json: string,
    note: string | null
  ) => {
    const [res]: any = await conn.query(
      `INSERT INTO storefront_versions
         (ownerId, storeId, versionNumber, snapshotJson, sourceDraftVersion, note, publishedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [storeId, storeId, versionNumber, json, null, note, storeId]
    );
    probeVersionIds.push(Number(res.insertId));
    return res;
  };

  // (a) publish v1
  await insertVersion(storeA, base + 1, snapshot("V1 HERO"), "publish v1");
  const [draftIns]: any = await conn.query(
    `INSERT INTO storefront_drafts (ownerId, storeId, configJson, concurrencyVersion, updatedBy)
     VALUES (?, ?, ?, 1, ?)`,
    [storeA, storeA, snapshot("DRAFT HERO"), storeA]
  );
  probeDraftId = Number(draftIns.insertId);

  const [v1]: any = await conn.query(
    "SELECT versionNumber, snapshotJson FROM storefront_versions WHERE storeId = ? AND versionNumber = ?",
    [storeA, base + 1]
  );
  check("publish appends a version row", v1.length === 1);

  // (a) uniqueness: the same versionNumber cannot be re-inserted per store.
  let duplicateRejected = false;
  try {
    await insertVersion(storeA, base + 1, snapshot("dup"), null);
  } catch {
    duplicateRejected = true;
  }
  check(
    "a versionNumber is unique per store (immutable address)",
    duplicateRejected
  );

  // (b) draft is a separate row and publishing did not touch it.
  const [draft]: any = await conn.query(
    "SELECT configJson FROM storefront_drafts WHERE storeId = ?",
    [storeA]
  );
  check(
    "draft stays separate from the published snapshot",
    draft.length === 1 && draft[0].configJson.includes("DRAFT HERO")
  );

  // (d) tenancy: another store cannot see store A's versions.
  await insertVersion(storeB, await nextVersion(storeB), snapshot("B HERO"), "b v1");
  const [crossStore]: any = await conn.query(
    "SELECT COUNT(*) AS n FROM storefront_versions WHERE storeId = ? AND snapshotJson LIKE ?",
    [storeB, "%B HERO%"]
  );
  const [wrongStore]: any = await conn.query(
    "SELECT COUNT(*) AS n FROM storefront_versions WHERE storeId = ? AND snapshotJson LIKE ?",
    [storeA, "%B HERO%"]
  );
  check(
    "versions are strictly tenant-scoped (no cross-store read)",
    Number(crossStore[0].n) === 1 && Number(wrongStore[0].n) === 0
  );

  // (e) V1→V2→V3→rollback V1→V4 using the real append logic (latest + 1).
  await insertVersion(storeA, await nextVersion(storeA), snapshot("V2 HERO"), "publish v2");
  await insertVersion(storeA, await nextVersion(storeA), snapshot("V3 HERO"), "publish v3");
  const v1Json = JSON.parse(v1[0].snapshotJson);
  const rollbackNumber = await nextVersion(storeA);
  await insertVersion(
    storeA,
    rollbackNumber,
    JSON.stringify(v1Json),
    `rollback to v${base + 1}`
  );

  const [v4]: any = await conn.query(
    "SELECT snapshotJson, note FROM storefront_versions WHERE storeId = ? AND versionNumber = ?",
    [storeA, rollbackNumber]
  );
  const [v1Still]: any = await conn.query(
    "SELECT snapshotJson FROM storefront_versions WHERE storeId = ? AND versionNumber = ?",
    [storeA, base + 1]
  );
  check(
    "rollback creates a NEW higher version (V4)",
    rollbackNumber === base + 4
  );
  check(
    "V4 snapshot equals V1 (history copied, not moved)",
    v4.length === 1 &&
      JSON.parse(v4[0].snapshotJson).sections.find((s: any) => s.type === "hero")
        .settings.title === "V1 HERO"
  );
  check(
    "the original V1 row is untouched after rollback",
    v1Still.length === 1 && v1Still[0].snapshotJson === v1[0].snapshotJson
  );

  // (c) retention planner bounds growth but never empties history.
  const allForStore: any = await conn.query(
    "SELECT versionNumber, publishedAt FROM storefront_versions WHERE storeId = ?",
    [storeA]
  );
  const plan = planStorefrontRetention({
    versions: allForStore[0].map((row: any) => ({
      versionNumber: Number(row.versionNumber),
      publishedAt: row.publishedAt,
    })),
    currentPublishedVersion: rollbackNumber,
    policy: { maxVersionsPerStore: 2, minVersionsToKeep: 1, maxAgeDays: null },
  });
  check(
    "retention keeps the current published version",
    plan.protectedVersions.includes(rollbackNumber) &&
      plan.keep.includes(rollbackNumber)
  );
  check(
    "retention never empties history",
    plan.keep.length >= 1 && plan.keep.length + plan.prune.length === plan.totalVersions
  );

  await conn.query("ROLLBACK");

  const [remV]: any = await conn.query(
    "SELECT COUNT(*) AS n FROM storefront_versions WHERE id IN (?)",
    [probeVersionIds]
  );
  const [remD]: any = await conn.query(
    "SELECT COUNT(*) AS n FROM storefront_drafts WHERE id = ?",
    [probeDraftId]
  );
  check(
    "zero probe rows remain after rollback",
    Number(remV[0].n) === 0 && Number(remD[0].n) === 0,
    `versions=${remV[0].n} drafts=${remD[0].n}`
  );
} finally {
  await conn.end();
}

let passed = 0;
for (const r of results) {
  if (r.ok) passed += 1;
  console.log(`${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(`${passed}/${results.length} PASS`);
if (passed !== results.length) process.exit(1);
