import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import { resolve } from 'node:path';
/** Node development uses the same SQLite schema; deployed Workers always use their D1 binding. */
export function localAdapter() {
  const root = process.cwd().endsWith('/apps/web')
    ? resolve(process.cwd(), '../..')
    : process.cwd();
  const configured = process.env.LOCAL_DATABASE_URL ?? 'file:./prisma/local.db';
  const url =
    configured === ':memory:'
      ? configured
      : `file:${resolve(root, configured.replace(/^file:/, ''))}`;
  return new PrismaBetterSQLite3({ url });
}
