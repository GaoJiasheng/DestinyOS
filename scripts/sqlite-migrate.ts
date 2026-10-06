import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
/** Apply ordered D1 SQL migrations to a local SQLite database; the same files are used by Wrangler. */
export function migrateSqlite(url = process.env.LOCAL_DATABASE_URL ?? 'file:./prisma/local.db') {
  const path = url.replace(/^file:/, '');
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  // DESIGN-GAP: Local browser tests and the Node server share a file; WAL permits readers while another connection commits a batch.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
  const migrations = resolve(import.meta.dirname, '../apps/web/migrations');
  for (const name of readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    if (db.prepare('SELECT 1 FROM _local_migrations WHERE name=?').get(name)) continue;
    db.transaction(() => {
      db.exec(readFileSync(resolve(migrations, name), 'utf8'));
      db.prepare('INSERT INTO _local_migrations VALUES (?)').run(name);
    })();
  }
  db.close();
}
if (process.argv[1]?.endsWith('sqlite-migrate.ts')) migrateSqlite();
