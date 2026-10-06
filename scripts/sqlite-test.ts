import { PrismaClient } from '@prisma/client';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { migrateSqlite } from './sqlite-migrate';
/** Stable isolated file paths let browser tests and their Next.js server share the same SQLite state. */
export function testDatabaseUrl(port: number) {
  return `file:${resolve(import.meta.dirname, '../.test-data', `db-${port}.sqlite`)}`;
}
/** Create a SQLite Prisma client for browser test setup and assertions. */
export function sqliteClient(
  url: string = process.env.LOCAL_DATABASE_URL ?? testDatabaseUrl(55432),
) {
  return new PrismaClient({ adapter: new PrismaBetterSQLite3({ url }) });
}
/** A fresh database with the actual D1 migrations for integration unit tests. */
export function isolatedSqlite() {
  const folder = mkdtempSync(resolve(tmpdir(), 'destinyos-sqlite-'));
  const url = `file:${resolve(folder, 'test.sqlite')}`;
  migrateSqlite(url);
  const direct = new Database(url.slice(5));
  direct.pragma('foreign_keys=ON');
  return {
    url,
    client: sqliteClient(url),
    async query(sql: string, values: unknown[] = []) {
      const query = direct.prepare(sql.replace(/\$\d+/g, '?'));
      return query.reader ? query.all(...values) : query.run(...values);
    },
    async close() {
      direct.close();
      rmSync(folder, { recursive: true, force: true });
    },
  };
}
