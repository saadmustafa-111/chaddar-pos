import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH ?? './data/steelcoil.db',
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: true,
    migrations: [path.resolve(__dirname, '../apps/api/dist/database/migrations/*.js')],
    logging: false,
  });
  await ds.initialize();
  console.log('OK: migrations applied, all schema columns are present.');
  await ds.destroy();
}

main().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
