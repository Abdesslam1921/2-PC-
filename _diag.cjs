const mysql = require("mysql2/promise");
(async () => {
  const c = await mysql.createConnection({ uri: process.env.DBURL });
  const [rows] = await c.query(
    "SELECT id, title, productKind, status, upsellProductId, upsellPrice, upsellDiscountAmount, upsellDiscountPercent, price, compareAtPrice FROM store_products WHERE title LIKE '%sgsgs%' OR title LIKE '%تجريبي%' ORDER BY id"
  );
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
  await c.end();
})().catch((e) => {
  console.error("ERR", e.code || e.message);
  process.exit(1);
});
