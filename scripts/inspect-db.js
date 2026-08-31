const Database = require('C:/ahmedchadar/chaddar-pos/apps/api/node_modules/better-sqlite3');
const dbPath = 'C:/ahmedchadar/chaddar-pos/apps/api/data/steelcoil.db';
const db = new Database(dbPath);

console.log('=== TABLES ===');
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
tables.forEach((t) => console.log(' -', t.name));

console.log('\n=== MIGRATIONS APPLIED ===');
try {
  const mig = db
    .prepare('SELECT id, name, timestamp FROM migrations ORDER BY timestamp')
    .all();
  mig.forEach((m) => console.log(` - [${m.id}] ${m.name} @ ${m.timestamp}`));
} catch (e) {
  console.log('No migrations table or unreadable:', e.message);
}

console.log('\n=== COILS SCHEMA ===');
const coilCols = db.prepare("PRAGMA table_info('coils')").all();
coilCols.forEach((c) =>
  console.log(` - ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''} (pk=${c.pk})`),
);

console.log('\n=== COILS INDEXES ===');
const coilIdx = db.prepare("PRAGMA index_list('coils')").all();
coilIdx.forEach((i) => {
  const info = db.prepare(`PRAGMA index_info('${i.name}')`).all();
  console.log(` - ${i.name} (unique=${i.unique}): ${info.map((c) => c.name).join(', ')}`);
});

console.log('\n=== CUTTING_BATCHES SCHEMA ===');
const cutCols = db.prepare("PRAGMA table_info('cutting_batches')").all();
cutCols.forEach((c) =>
  console.log(` - ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''} (pk=${c.pk})`),
);

console.log('\n=== CUTTING_BATCHES INDEXES ===');
const cutIdx = db.prepare("PRAGMA index_list('cutting_batches')").all();
cutIdx.forEach((i) => {
  const info = db.prepare(`PRAGMA index_info('${i.name}')`).all();
  console.log(` - ${i.name} (unique=${i.unique}): ${info.map((c) => c.name).join(', ')}`);
});

console.log('\n=== FINISHED_CHADDAR_STOCK SCHEMA ===');
const stockCols = db
  .prepare("PRAGMA table_info('finished_chaddar_stock')")
  .all();
stockCols.forEach((c) =>
  console.log(` - ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''} (pk=${c.pk})`),
);

console.log('\n=== FINISHED_CHADDAR_STOCK INDEXES ===');
const stockIdx = db
  .prepare("PRAGMA index_list('finished_chaddar_stock')")
  .all();
stockIdx.forEach((i) => {
  const info = db.prepare(`PRAGMA index_info('${i.name}')`).all();
  console.log(` - ${i.name} (unique=${i.unique}): ${info.map((c) => c.name).join(', ')}`);
});

console.log('\n=== PRICE_CATEGORIES SCHEMA ===');
const pcCols = db.prepare("PRAGMA table_info('price_categories')").all();
pcCols.forEach((c) =>
  console.log(` - ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''} (pk=${c.pk})`),
);

console.log('\n=== FOREIGN KEYS ON COILS ===');
const fks1 = db.prepare("PRAGMA foreign_key_list('coils')").all();
fks1.forEach((f) =>
  console.log(
    ` - ${f.from} -> ${f.table}.${f.to} (on_update=${f.on_update} on_delete=${f.on_delete})`,
  ),
);

console.log('\n=== FOREIGN KEYS ON CUTTING_BATCHES ===');
const fks2 = db.prepare("PRAGMA foreign_key_list('cutting_batches')").all();
fks2.forEach((f) =>
  console.log(
    ` - ${f.from} -> ${f.table}.${f.to} (on_update=${f.on_update} on_delete=${f.on_delete})`,
  ),
);

console.log('\n=== FOREIGN KEYS ON FINISHED_CHADDAR_STOCK ===');
const fks3 = db
  .prepare("PRAGMA foreign_key_list('finished_chaddar_stock')")
  .all();
fks3.forEach((f) =>
  console.log(
    ` - ${f.from} -> ${f.table}.${f.to} (on_update=${f.on_update} on_delete=${f.on_delete})`,
  ),
);

db.close();
