import SQLite from 'better-sqlite3';
import type { SQLiteBindValue } from 'expo-sqlite';
import { LocalDatabase, type SqlConnection } from '../lib/data/database';
import { migrate } from '../lib/data/migrations';
/** Real SQLite adapter verifies SQL constraints, migration/transaction behavior, and persistence. */
export function sqliteConnection(filename = ':memory:'): SqlConnection {
  const db = new SQLite(filename);
  db.pragma('foreign_keys = ON');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...params: SQLiteBindValue[]) {
      return db.prepare(sql).run(...params);
    },
    async getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async closeAsync() {
      db.close();
    },
  };
}
/** Start at the production schema version on a clean in-memory SQLite database. */
export async function testDatabase() {
  const database = new LocalDatabase(sqliteConnection());
  await migrate(database);
  return database;
}
