import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import path from 'node:path';
import fs from 'node:fs';

const isProduction = process.env.NODE_ENV === 'production';
const DEV_DEFAULT_DB = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'steelcoil.db',
);

function validateDatabasePath(dbPath: string | undefined): string {
  if (!dbPath || typeof dbPath !== 'string') {
    throw new Error(
      `FATAL: DATABASE_PATH is missing or empty. Received: ${JSON.stringify(dbPath)}`,
    );
  }

  const resolved = path.resolve(dbPath);

  if (resolved === path.parse(resolved).root) {
    throw new Error(
      `FATAL: DATABASE_PATH resolves to filesystem root '${resolved}'. Path must be a file path, not a drive root. Received: ${JSON.stringify(dbPath)}`,
    );
  }

  const dir = path.dirname(resolved);
  if (dir === path.parse(dir).root) {
    throw new Error(
      `FATAL: DATABASE_PATH parent directory is filesystem root '${dir}'. Received: ${JSON.stringify(dbPath)}`,
    );
  }

  if (isProduction && !path.isAbsolute(resolved)) {
    throw new Error(
      `FATAL: DATABASE_PATH must be absolute in production. Received: ${JSON.stringify(dbPath)}`,
    );
  }

  return resolved;
}

function ensureDbParentDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    throw new Error(
      `FATAL: Cannot create DB parent directory '${dir}' for DATABASE_PATH '${dbPath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const rawDbPath = process.env.DATABASE_PATH;
let resolvedDbPath: string;

if (isProduction) {
  if (!rawDbPath) {
    throw new Error(
      `FATAL: DATABASE_PATH is required in production but is not set.`,
    );
  }
  resolvedDbPath = validateDatabasePath(rawDbPath);
  ensureDbParentDir(resolvedDbPath);
} else {
  if (rawDbPath) {
    resolvedDbPath = validateDatabasePath(rawDbPath);
    ensureDbParentDir(resolvedDbPath);
    console.log('[DB Config] Database mode: explicit-env');
  } else {
    resolvedDbPath = DEV_DEFAULT_DB;
    ensureDbParentDir(resolvedDbPath);
    console.log('[DB Config] Database mode: development-default');
  }
}

console.log('[DB Config] NODE_ENV:', process.env.NODE_ENV);
console.log('[DB Config] Resolved DATABASE_PATH:', resolvedDbPath);

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: resolvedDbPath,

  autoLoadEntities: true,

  synchronize: false,

  migrationsRun: true,

  migrations: [__dirname + '/migrations/*.js'],

  logging: process.env.NODE_ENV === 'development',
};
