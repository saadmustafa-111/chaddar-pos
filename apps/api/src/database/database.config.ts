import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import path from 'node:path';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database:
    process.env.DATABASE_PATH ??
    path.resolve(process.cwd(), 'data', 'steelcoil.db'),

  autoLoadEntities: true,

  synchronize: false,

  migrationsRun: true,

  migrations: [path.resolve(__dirname, 'migrations/*.js')],

  logging: process.env.NODE_ENV === 'development',
};
