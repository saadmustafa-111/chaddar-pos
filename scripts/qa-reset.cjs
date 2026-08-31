/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const Database = require(
  path.resolve(__dirname, '..', 'apps/api/node_modules/better-sqlite3'),
);

const dbPath = path.resolve(
  __dirname,
  '..',
  'apps/api/data/steelcoil.db',
);
const db = new Database(dbPath);

const tables = [
  'customer_ledger_entries',
  'sale_items',
  'sales',
  'finished_chaddar_stock',
  'cutting_batches',
  'inventory_movements',
  'coil_landing_expenses',
  'coils',
  'purchases',
  'customers',
  'suppliers',
  'material_families',
];

for (const t of tables) {
  try {
    db.prepare(`DELETE FROM "${t}"`).run();
  } catch (_e) {
    /* table may not exist yet */
  }
}

db.prepare("DELETE FROM sqlite_sequence").run();

try {
  db.prepare(
    `UPDATE price_categories SET selling_rate_paisa = 0, purchase_rate_paisa = 0`,
  ).run();
} catch (_e) {
  /* ignore */
}

db.close();
console.log('OK: dev database cleared.');
