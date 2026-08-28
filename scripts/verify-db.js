const Database = require('better-sqlite3');
const db = new Database('apps/api/data/steelcoil.db');

const cols1 = db.prepare("PRAGMA table_info(finished_chaddar_stock)").all();
const cols2 = db.prepare("PRAGMA table_info(cutting_batches)").all();
console.log('finished_chaddar_stock columns:', cols1.map(c => c.name + ':' + c.type));
console.log('cutting_batches columns:', cols2.map(c => c.name + ':' + c.type));

const sample = db.prepare('SELECT code, size_label, weight_per_piece_kg, total_weight_kg, pieces_produced FROM finished_chaddar_stock LIMIT 5').all();
console.log('Sample stock:', JSON.stringify(sample, null, 2));

const stockCount = db.prepare('SELECT COUNT(*) AS c FROM finished_chaddar_stock').get();
const withWpp = db.prepare('SELECT COUNT(*) AS c FROM finished_chaddar_stock WHERE weight_per_piece_kg IS NOT NULL').get();
console.log('Stock total:', stockCount.c, 'with wpp:', withWpp.c);
