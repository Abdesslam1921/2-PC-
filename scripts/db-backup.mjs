/**
 * Manual, read-only logical backup (schema + data) for the TiDB Cloud database.
 *
 * Uses the project's existing `mysql2` (no external mysql client required).
 * Output: an .sql file in the pre-approved temp dir. Credentials are read from
 * .env and NEVER printed.
 *
 * Usage: node scripts/db-backup.mjs
 */
import { createConnection } from "mysql2/promise";
import fs from "node:fs";

const ROOT = "C:/dev/abdou-store-main";
const OUT_DIR = "C:/Users/CPADJI~1/AppData/Local/Temp/kilo";

const env = fs.readFileSync(`${ROOT}/.env`, "utf8");
const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
if (!m) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
const url = m[1].trim().replace(/^['"]|['"]$/g, "");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = `${OUT_DIR}/abdou-backup-${stamp}.sql`;
const out = fs.createWriteStream(outPath, { encoding: "utf8" });

const write = line =>
  new Promise((resolve, reject) => {
    if (!out.write(line + "\n")) out.once("drain", resolve);
    else resolve();
  });

async function main() {
  const conn = await createConnection(url);
  await write("-- Abdou Store manual backup");
  await write(`-- Generated: ${new Date().toISOString()}`);
  await write("SET FOREIGN_KEY_CHECKS=0;");
  await write("SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';");
  await write("");

  const [tables] = await conn.query(
    "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
  );
  const nameKey = Object.keys(tables[0] ?? {}).find(k =>
    k.startsWith("Tables_in_")
  );
  let totalRows = 0;

  for (const row of tables) {
    const table = row[nameKey];
    const [ddlRows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
    await write(`-- ---------- ${table} ----------`);
    await write(`DROP TABLE IF EXISTS \`${table}\`;`);
    await write(`${ddlRows[0]["Create Table"]};`);

    const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
    totalRows += rows.length;
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `\`${c}\``).join(", ");
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const values = chunk
          .map(r => "(" + cols.map(c => conn.escape(r[c])).join(", ") + ")")
          .join(",\n  ");
        await write(`INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};`);
      }
    }
    await write("");
    console.log(`${table}: ${rows.length} rows`);
  }

  await write("SET FOREIGN_KEY_CHECKS=1;");
  await conn.end();
  await new Promise(r => out.end(r));
  const { size } = fs.statSync(outPath);
  console.log(`\nDONE tables=${tables.length} rows=${totalRows} bytes=${size}`);
  console.log(`FILE ${outPath}`);
}

main().catch(async err => {
  console.error("BACKUP FAILED:", err?.code || err?.message || err);
  try {
    await new Promise(r => out.end(r));
  } catch {}
  process.exit(1);
});
