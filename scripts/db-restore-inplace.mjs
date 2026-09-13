/**
 * In-place backup restore verification.
 *
 * Restores a logical dump into the SAME database using `rc_`-prefixed temp
 * tables (needed because the TiDB user cannot CREATE DATABASE), verifies row
 * counts per table, then removes every temp table.
 *
 * Safety guarantees (per requirements):
 *  (1) Aborts if ANY `rc_`-prefixed table already exists (no collisions).
 *  (2) FOREIGN KEY constraints are stripped from temp DDL, so temp tables never
 *      depend on live source tables.
 *  (3) Cleanup is guaranteed via try/finally + signal handlers; a manual
 *      fallback mode is available:  node scripts/db-restore-inplace.mjs --cleanup
 *
 * Usage: node scripts/db-restore-inplace.mjs <path-to-dump.sql>
 * Credentials are read from .env and never printed.
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";

const ROOT = "C:/dev/abdou-store-main";
const PREFIX = "rc_";
const args = process.argv.slice(2);
const cleanupOnly = args.includes("--cleanup");
const listOnly = args.includes("--list");
const verifyOnly = args.includes("--verify");
const storesOnly = args.includes("--stores");
const dumpPath = args.find(a => !a.startsWith("--"));

const env = fs.readFileSync(`${ROOT}/.env`, "utf8");
const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
if (!m) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
const url = m[1].trim().replace(/^['"]|['"]$/g, "");

async function listPrefixed(conn) {
  const [rows] = await conn.query(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'rc\\_%'"
  );
  return rows.map(r => r.t);
}

async function dropTables(conn, names) {
  for (const n of names) {
    try {
      await conn.query(`DROP TABLE IF EXISTS \`${n}\``);
    } catch (e) {
      console.error(`cleanup warning (${n}):`, e?.code || e?.message);
    }
  }
}

/** Best-effort cleanup on abrupt interruption, using a fresh connection. */
async function emergencyCleanup(label) {
  let conn;
  try {
    conn = await createConnection({ uri: url, multipleStatements: true });
    const names = await listPrefixed(conn);
    if (names.length) {
      console.error(`\n[${label}] dropping ${names.length} temp table(s)…`);
      await dropTables(conn, names);
    }
  } catch (e) {
    console.error(`[${label}] emergency cleanup failed:`, e?.code || e?.message);
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {}
    }
  }
}

process.on("SIGINT", async () => {
  await emergencyCleanup("SIGINT");
  process.exit(130);
});
process.on("SIGTERM", async () => {
  await emergencyCleanup("SIGTERM");
  process.exit(143);
});
process.on("uncaughtException", async err => {
  console.error("uncaught:", err?.message || err);
  await emergencyCleanup("uncaughtException");
  process.exit(1);
});

async function main() {
  const conn = await createConnection({ uri: url, multipleStatements: true });

  if (listOnly) {
    const [rows] = await conn.query("SHOW TABLES LIKE 'rc\\_%'");
    console.log("SHOW TABLES LIKE 'rc\\_%' →", rows.length);
    if (rows.length) console.log(rows.map(r => Object.values(r)[0]).join(", "));
    await conn.end();
    return;
  }

  if (verifyOnly) {
    const [rows] = await conn.query("SHOW TABLES");
    const names = rows.map(r => Object.values(r)[0]);
    const expected = [
      "storefront_drafts",
      "storefront_versions",
      "storefront_audit_logs",
      "dashboard_color_settings",
    ];
    const missing = expected.filter(t => !names.includes(t));
    let totalRows = 0;
    for (const t of names) {
      const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      totalRows += Number(c[0].n);
    }
    for (const t of expected) {
      const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      const [cols] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}'`
      );
      console.log(`${t}: exists cols=${cols[0].n} rows=${c[0].n}`);
    }
    console.log(
      `\ntotal tables=${names.length} missing=${missing.length} totalRows=${totalRows}`
    );
    if (missing.length) console.log("MISSING:", missing.join(", "));
    await conn.end();
    return;
  }

  if (storesOnly) {
    const [rows] = await conn.query(
      "SELECT id, slug, name, isActive FROM stores ORDER BY id"
    );
    for (const s of rows) {
      const [pub] = await conn.query(
        "SELECT MAX(versionNumber) AS v FROM storefront_versions WHERE storeId = ?",
        [s.id]
      );
      console.log(
        `store id=${s.id} slug=${s.slug} name=${s.name} active=${s.isActive} publishedModern=${pub[0]?.v ?? 0}`
      );
    }
    await conn.end();
    return;
  }

  if (cleanupOnly) {
    const names = await listPrefixed(conn);
    console.log(`manual cleanup: found ${names.length} rc_ table(s)`);
    await dropTables(conn, names);
    await conn.end();
    console.log("manual cleanup done");
    return;
  }

  if (!dumpPath || !fs.existsSync(dumpPath)) {
    console.error("Dump file not found:", dumpPath ?? "(missing argument)");
    await conn.end();
    process.exit(1);
  }

  const dump = fs.readFileSync(dumpPath, "utf8");
  const tables = [...dump.matchAll(/CREATE TABLE `([^`]+)`/g)].map(x => x[1]);
  const prefixed = tables.map(t => `${PREFIX}${t}`);

  // (1) collision check — abort before creating anything
  const existing = await listPrefixed(conn);
  if (existing.length) {
    console.error(
      `ABORT: ${existing.length} rc_ table(s) already exist: ${existing.join(", ")}`
    );
    console.error("Run with --cleanup first (they may be leftovers).");
    await conn.end();
    process.exit(3);
  }

  // (2) strip FK constraints so temp tables never reference live tables
  const fkCount = (dump.match(/FOREIGN KEY/gi) || []).length;
  let script = dump
    .replace(/CREATE TABLE `([^`]+)`/g, (_m, t) => `CREATE TABLE \`${PREFIX}${t}\``)
    .replace(
      /DROP TABLE IF EXISTS `([^`]+)`/g,
      (_m, t) => `DROP TABLE IF EXISTS \`${PREFIX}${t}\``
    )
    .replace(/INSERT INTO `([^`]+)`/g, (_m, t) => `INSERT INTO \`${PREFIX}${t}\``);
  if (fkCount > 0) {
    script = script
      .split("\n")
      .filter(line => !/FOREIGN KEY/i.test(line))
      .join("\n")
      .replace(/,\s*\)/g, "\n)");
  }

  let created = false;
  try {
    await conn.query(script);
    created = true;
    console.log(`restored ${tables.length} temp tables (fcCount=${fkCount} stripped)`);

    let mismatches = 0;
    let totalRows = 0;
    for (const t of tables) {
      const [a] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      const [b] = await conn.query(`SELECT COUNT(*) AS n FROM \`${PREFIX}${t}\``);
      const src = Number(a[0].n);
      const dst = Number(b[0].n);
      totalRows += src;
      if (src !== dst) {
        mismatches++;
        console.error(`MISMATCH ${t}: source=${src} restored=${dst}`);
      }
    }
    console.log(
      `\nchecked tables=${tables.length} rows=${totalRows} mismatches=${mismatches}`
    );
    console.log(
      mismatches === 0
        ? "\nRESULT: IN-PLACE RESTORE VERIFIED ✅"
        : "\nRESULT: IN-PLACE RESTORE MISMATCH ❌"
    );
    if (mismatches !== 0) process.exitCode = 2;
  } finally {
    // (3) guaranteed cleanup on a FRESH connection: the main connection may
    // have been closed by the server after the large multi-statement script.
    try {
      await conn.end();
    } catch {}
    await emergencyCleanup("finally");
    console.log(`cleanup finished (${created ? "restored" : "not created"})`);
  }
}

main().catch(async err => {
  console.error("RESTORE FAILED:", err?.code || err?.message || err);
  await emergencyCleanup("failure");
  process.exit(1);
});
