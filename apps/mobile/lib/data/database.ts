import type { SQLiteBindValue } from 'expo-sqlite';

/** Minimal async SQLite boundary, shared by SQLCipher and real SQLite unit tests. */
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SQLiteBindValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}
/** Serialize every operation on one keyed connection; rollback includes all dependent writes. */
export class LocalDatabase {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly connection: SqlConnection) {}
  /** Read a consistent snapshot without interleaving local writes. */
  read<T>(operation: (sql: SqlConnection) => Promise<T>): Promise<T> {
    return this.enqueue(() => operation(this.connection));
  }
  /** Atomic mutation; use the supplied connection exclusively inside the callback. */
  write<T>(operation: (sql: SqlConnection) => Promise<T>): Promise<T> {
    // DESIGN-GAP: Expo's exclusive helper opens an unkeyed connection. Queue BEGIN IMMEDIATE
    // on the single keyed connection instead, including reads, to prevent async transaction leaks.
    return this.enqueue(async () => {
      await this.connection.execAsync('BEGIN IMMEDIATE');
      try {
        const result = await operation(this.connection);
        await this.connection.execAsync('COMMIT');
        return result;
      } catch (error) {
        await this.connection.execAsync('ROLLBACK');
        throw error;
      }
    });
  }
  /** Wait for in-flight work before releasing the native connection. */
  close(): Promise<void> {
    return this.enqueue(() => this.connection.closeAsync());
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.pending.then(operation);
    this.pending = next.catch(() => undefined);
    return next;
  }
}
