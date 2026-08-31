const db = require('better-sqlite3')('./data/steelcoil.db');
const r = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((t) => t.name)
  .sort();
const cats = db.prepare('SELECT * FROM price_categories').all();
const counts = db
  .prepare(
    "SELECT (SELECT COUNT(*) FROM suppliers) as sup, (SELECT COUNT(*) FROM coils) as coils, (SELECT COUNT(*) FROM customers) as cus, (SELECT COUNT(*) FROM sales) as sale, (SELECT COUNT(*) FROM finished_chaddar_stock) as stock, (SELECT COUNT(*) FROM purchases) as pur, (SELECT COUNT(*) FROM cutting_batches) as cut, (SELECT COUNT(*) FROM coil_landing_expenses) as le, (SELECT COUNT(*) FROM customer_ledger_entries) as cl",
  )
  .all()[0];
console.log(JSON.stringify({ tables: r, cats, counts }, null, 2));
