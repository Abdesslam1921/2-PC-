/**
 * Verify a logical backup by restoring it into a scratch database on the same
 * TiDB Cloud cluster, comparing exact table/row counts, then dropping the
 * scratch database. Read/write only to the scratch DB; the source is untouched.
 *
 * Usage: node scripts/db-restore-check.mjs <path-to-dump.sql>
 * Credentials are read from .env and never printed.
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/dev/abdou-store-main";
const dumpPath = process.argv[2];
const targetDbArg = process.argv[3]; // optional: pre-created empty test database
if (!dumpPath || !fs.existsSync(dumpPath)) {
  console.error("Dump file not found:", dumpPath ?? "(missing argument)");
  process.exit(1);
}

const env = fs.readFileSync(`${ROOT}/.env`, "utf8");
const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
if (!m) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
const url = m[1].trim().replace(/^['"]|['"]$/g, "");
const dbName = new URL(url).pathname.replace(/^\//, "");
const scratch = `restore_check_${Date.now()}`;

async function tableCounts(conn) {
  const [rows] = await conn.query(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE'"
  );
  const counts = {};
  for (const r of rows) {
    const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${r.t}\``);
    counts[r.t] = Number(c[0].n);
  }
  return counts;
}

async function main() {
  const admin = await createConnection({ uri: url, multipleStatements: true });
  const targetDb = targetDbArg || scratch;
  if (targetDbArg) {
    console.log(`using existing test database: ${targetDb}`);
  } else {
    await admin.query(`CREATE DATABASE \`${scratch}\``);
    console.log("scratch database created");
  }

  const sql = fs.readFileSync(dumpPath, "utf8");
  const scratchUrl = new URL(url);
  scratchUrl.pathname = `/${targetDb}`;
  const target = await createConnection({
    uri: scratchUrl.toString(),
    multipleStatements: true,
  });

  await target.query(sql);
  console.log("dump applied");

  const [srcConn] = await Promise.all([
    createConnection({ uri: url }),
  ]);
  const [src, dst] = await Promise.all([
    tableCounts(srcConn),
    tableCounts(target),
  ]);

  const srcTables = Object.keys(src);
  const missing = srcTables.filter(t => !(t in dst));
  const mismatched = srcTables.filter(t => (t in dst) && dst[t] !== src[t]);

  console.log(`\nsource tables=${srcTables.length} restored tables=${Object.keys(dst).length}`);
  console.log(`missing=${missing.length} mismatched=${mismatched.length}`);
  if (missing.length) console.log("missing:", missing.join(", "));
  if (mismatched.length)
    console.log(
      "mismatched:",
      mismatched.map(t => `${t}(${src[t]}->${dst[t]})`).join(", ")
    );

  await srcConn.end();
  await target.end();
  if (targetDbArg) {
    await admin.end();
    console.log(`left existing test database in place (${targetDb})`);
  } else {
    await admin.query(`DROP DATABASE \`${scratch}\``);
    await admin.end();
    console.log(`scratch database dropped (${scratch})`);
  }

  const ok = missing.length === 0 && mismatched.length === 0;
  console.log(ok ? "\nRESULT: RESTORE VERIFIED ✅" : "\nRESULT: RESTORE MISMATCH ❌");
  process.exit(ok ? 0 : 2);
}

main().catch(async err => {
  console.error("RESTORE-CHECK FAILED:", err?.code || err?.message || err);
  process.exit(1);
});
