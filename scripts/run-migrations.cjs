/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const apiDir = path.resolve(__dirname, '../apps/api');
const apiNodeModules = path.join(apiDir, 'node_modules');
require(path.join(apiNodeModules, 'reflect-metadata'));
const { DataSource } = require(path.join(apiNodeModules, 'typeorm'));

async function main() {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database:
      process.env.DATABASE_PATH ?? path.join(apiDir, 'data/steelcoil.db'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: true,
    migrations: [
      path.resolve(apiDir, 'dist/database/migrations/*.js'),
    ],
    logging: false,
  });
  await ds.initialize();
  console.log('OK: migrations applied.');
  await ds.destroy();
}

main().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
