const D = require('C:/ahmedchadar/chaddar-pos/apps/api/node_modules/better-sqlite3');
const db = new D('C:/ahmedchadar/chaddar-pos/apps/api/data/steelcoil.db');

console.log('Coil columns with price_category_id:',
  db.prepare("PRAGMA table_info('coils')").all().filter(c => c.name === 'price_category_id').length);

console.log('PriceCategory columns:',
  db.prepare("PRAGMA table_info('price_categories')").all().map(c => c.name).join(','));

console.log('Price categories:');
console.log(db.prepare('SELECT id, code, name, selling_rate_paisa, is_active FROM price_categories ORDER BY code').all());

db.close();
