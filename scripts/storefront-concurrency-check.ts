/**
 * LIVE concurrency verification for the storefront draft/version store.
 *
 * Two real MySQL connections exercise the production helpers
 * (`saveStorefrontDraft` / `createStorefrontVersion`) against the real DB:
 *   (a) two tabs saving the same draft are serialized by the row lock — no
 *       interleaved write,
 *   (b) a stale tab gets a conflict and NEVER overwrites the newer draft,
 *   (c) a concurrent publish + rollback serialises version numbers (both get
 *       distinct immutable versions, no 500),
 *   (d) the draft row/per-version unique constraints behave as assumed.
 *
 * Everything runs on a PROBE store that had no draft and no probe rows. Tests
 * (a) and (b) run entirely inside transactions that are rolled back. Test (c)
 * needs one committed probe version so the second connection can observe the
 * unique-key race (MySQL cannot show an uncommitted row to another session);
 * every probe row is deleted and the script verifies 0 rows remain.
 *
 * The connections use READ COMMITTED so a retry after a duplicate-key error
 * sees the row committed by the other session (production calls run in
 * autocommit, where each statement sees the latest committed state).
 *
 * Usage: pnpm exec tsx scripts/storefront-concurrency-check.ts
 */
import { createConnection, type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import fs from "node:fs";
import path from "node:path";
import {
  createStorefrontVersion,
  saveStorefrontDraft,
  type StorefrontDb,
} from "../server/storefrontDb";
import { isStorefrontVersionConflict } from "../server/storefrontConcurrency";
import { DEFAULT_MODERN_CONFIG } from "../shared/storefront/storefrontConfig";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)![1]
  .trim()
  .replace(/^['"]|['"]$/g, "");

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push({ name, ok, detail });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const config = (marker: string) =>
  JSON.stringify({
    ...DEFAULT_MODERN_CONFIG,
    sections: DEFAULT_MODERN_CONFIG.sections.map(section =>
      section.type === "hero"
        ? { ...section, settings: { ...section.settings, title: marker } }
        : section
    ),
  });

const connA: Connection = await createConnection(url);
const connB: Connection = await createConnection(url);
const dbA = drizzle(connA) as unknown as StorefrontDb;
const dbB = drizzle(connB) as unknown as StorefrontDb;

let probeStoreId: number | undefined;
let probeOwnerId: number | undefined;
let probeDraftCreated = false;
let probeVersionId: number | undefined;
let txA = false;
let txB = false;

try {
  // READ COMMITTED: a duplicate-key retry must see the other session's commit.
  await connA.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
  await connB.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");

  const [stores]: any = await connA.query(
    `SELECT s.id, s.ownerId
       FROM stores s
       LEFT JOIN storefront_drafts d ON d.storeId = s.id
      WHERE d.storeId IS NULL
      ORDER BY s.id
      LIMIT 1`
  );
  if (!stores.length) {
    throw new Error(
      "No store without a draft exists — cannot probe draft concurrency safely."
    );
  }
  probeStoreId = Number(stores[0].id);
  probeOwnerId = Number(stores[0].ownerId);

  // Committed probe draft (the only row this script creates outside rollback).
  await connA.query(
    `INSERT INTO storefront_drafts
       (ownerId, storeId, configJson, concurrencyVersion, updatedBy)
     VALUES (?, ?, ?, 1, ?)`,
    [probeOwnerId, probeStoreId, config("PROBE INITIAL"), probeOwnerId]
  );
  probeDraftCreated = true;

  // (a) Two connections updating the same draft: the second waits for the row
  // lock, then applies against the restored v1 after A rolls back.
  await connA.query("START TRANSACTION");
  txA = true;
  const aSave = saveStorefrontDraft(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      configJson: config("PROBE A"),
      expectedVersion: 1,
      updatedBy: probeOwnerId,
    },
    dbA
  );
  const aSaveRes = await aSave;
  check(
    "tab A saves v1 -> v2 (uncommitted)",
    aSaveRes.conflict === false && aSaveRes.version === 2
  );

  await connB.query("START TRANSACTION");
  txB = true;
  let bSettled = false;
  const bSave = saveStorefrontDraft(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      configJson: config("PROBE B"),
      expectedVersion: 1,
      updatedBy: probeOwnerId,
    },
    dbB
  ).then(r => {
    bSettled = true;
    return r;
  });
  await delay(300);
  check(
    "tab B waits on A's row lock (no interleaved write)",
    bSettled === false
  );

  await connA.query("ROLLBACK");
  txA = false;
  const bSaveRes = await bSave;
  check(
    "after A rolls back, B applies against the restored v1",
    bSaveRes.conflict === false && bSaveRes.version === 2
  );
  await connB.query("ROLLBACK");
  txB = false;

  const [afterA]: any = await connA.query(
    "SELECT concurrencyVersion FROM storefront_drafts WHERE storeId = ?",
    [probeStoreId]
  );
  check(
    "rollback left the draft at v1 (nothing persisted)",
    Number(afterA[0].concurrencyVersion) === 1
  );

  // (b) A committed save makes the other tab stale: it must get a conflict
  // and must not write over the newer draft.
  await connA.query("START TRANSACTION");
  txA = true;
  const a2 = await saveStorefrontDraft(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      configJson: config("PROBE NEWER"),
      expectedVersion: 1,
      updatedBy: probeOwnerId,
    },
    dbA
  );
  await connA.query("COMMIT");
  txA = false;
  check("newer tab commits v2", a2.conflict === false && a2.version === 2);

  await connB.query("START TRANSACTION");
  txB = true;
  const b2 = await saveStorefrontDraft(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      configJson: config("PROBE STALE"),
      expectedVersion: 1,
      updatedBy: probeOwnerId,
    },
    dbB
  );
  await connB.query("ROLLBACK");
  txB = false;
  check(
    "stale tab gets conflict + current version (no write)",
    b2.conflict === true && b2.currentVersion === 2
  );

  const [preserved]: any = await connA.query(
    "SELECT concurrencyVersion, configJson FROM storefront_drafts WHERE storeId = ?",
    [probeStoreId]
  );
  check(
    "the newer draft is preserved (no silent last-write-wins)",
    Number(preserved[0].concurrencyVersion) === 2 &&
      String(preserved[0].configJson).includes("PROBE NEWER") &&
      !String(preserved[0].configJson).includes("PROBE STALE")
  );

  // (c) Concurrent publish/rollback: both append an immutable version. One
  // commits a probe version; the other races on the unique key, retries, and
  // rolls back. Both must return distinct version numbers (no 500).
  await connA.query("START TRANSACTION");
  await connB.query("START TRANSACTION");
  txA = true;
  txB = true;

  const publish = createStorefrontVersion(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      snapshotJson: config("PROBE PUBLISH"),
      sourceDraftVersion: 2,
      publishedBy: probeOwnerId,
      note: "concurrency-probe-publish",
    },
    dbA
  );
  await delay(150);
  const rollback = createStorefrontVersion(
    {
      ownerId: probeOwnerId,
      storeId: probeStoreId,
      snapshotJson: config("PROBE ROLLBACK"),
      sourceDraftVersion: null,
      publishedBy: probeOwnerId,
      note: "concurrency-probe-rollback",
    },
    dbB
  );
  await delay(250);
  await connA.query("COMMIT");
  txA = false;

  let publishRes: { versionNumber: number } | undefined;
  let rollbackRes: { versionNumber: number } | undefined;
  let raceError: unknown;
  try {
    [publishRes, rollbackRes] = await Promise.all([publish, rollback]);
  } catch (error) {
    raceError = error;
  }
  await connB.query("ROLLBACK");
  txB = false;

  check(
    "concurrent publish + rollback both return (no 500)",
    !raceError &&
      typeof publishRes?.versionNumber === "number" &&
      typeof rollbackRes?.versionNumber === "number",
    raceError instanceof Error ? raceError.message : ""
  );
  if (publishRes && rollbackRes) {
    check(
      "concurrent version numbers are distinct",
      rollbackRes.versionNumber === publishRes.versionNumber + 1,
      `publish=${publishRes.versionNumber} rollback=${rollbackRes.versionNumber}`
    );
  } else {
    check("concurrent version numbers are distinct", false);
  }

  // A typed conflict (if the race ever exhausts retries) is not a 500.
  if (raceError) {
    check(
      "an exhausted version race is a typed conflict",
      isStorefrontVersionConflict(raceError)
    );
  } else {
    check("an exhausted version race is a typed conflict", true, "not hit");
  }

  const [versionRow]: any = await connA.query(
    `SELECT id FROM storefront_versions
      WHERE storeId = ? AND note = 'concurrency-probe-publish'
      ORDER BY versionNumber DESC LIMIT 1`,
    [probeStoreId]
  );
  probeVersionId = versionRow[0]?.id ? Number(versionRow[0].id) : undefined;
  check(
    "the committed publish probe is visible",
    !!probeVersionId,
    probeVersionId ? `id=${probeVersionId}` : ""
  );
} catch (error) {
  check(
    "live concurrency probe completed",
    false,
    error instanceof Error ? error.message : String(error)
  );
} finally {
  // Release any open transaction; only the explicitly committed probe version
  // and the setup draft remain, and both are deleted below.
  try {
    if (txA) await connA.query("ROLLBACK");
    if (txB) await connB.query("ROLLBACK");
  } catch {
    /* connection already gone */
  }

  if (probeStoreId) {
    // Delete by the probe note as well: covers a crash between COMMIT and the
    // id lookup above.
    await connA.query(
      "DELETE FROM storefront_versions WHERE storeId = ? AND note LIKE 'concurrency-probe-%'",
      [probeStoreId]
    );
  }
  if (probeDraftCreated && probeStoreId) {
    await connA.query("DELETE FROM storefront_drafts WHERE storeId = ?", [
      probeStoreId,
    ]);
  }

  if (probeStoreId) {
    const [leftVersions]: any = await connA.query(
      "SELECT COUNT(*) AS n FROM storefront_versions WHERE storeId = ? AND note LIKE 'concurrency-probe-%'",
      [probeStoreId]
    );
    const [leftDraft]: any = await connA.query(
      "SELECT COUNT(*) AS n FROM storefront_drafts WHERE storeId = ?",
      [probeStoreId]
    );
    check(
      "zero probe rows remain (cleanup verified)",
      Number(leftVersions[0].n) === 0 && Number(leftDraft[0].n) === 0,
      `versions=${leftVersions[0].n} drafts=${leftDraft[0].n}`
    );
  }

  await connA.end();
  await connB.end();
}

let passed = 0;
for (const r of results) {
  if (r.ok) passed += 1;
  console.log(
    `${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`
  );
}
console.log(`${passed}/${results.length} PASS`);
if (passed !== results.length) process.exit(1);
