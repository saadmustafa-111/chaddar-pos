import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH,

  autoLoadEntities: true,

  synchronize: false,

  migrationsRun: true,

  migrations: [__dirname + '/migrations/*.js'],

  logging: process.env.NODE_ENV === 'development',
};
