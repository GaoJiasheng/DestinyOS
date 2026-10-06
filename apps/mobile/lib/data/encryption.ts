import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { LocalDatabase, type SqlConnection } from './database';
import { migrate } from './migrations';

export const databaseName = 'tianji-local.db';
const keyName = 'tianji.local.master-key.v1';
const secureOptions: SecureStore.SecureStoreOptions = {
  // DESIGN-GAP: Background local forecasts need access after first unlock; never sync the key
  // to another device or request biometrics (App plan A11). Android uses its Keystore backend.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
export interface EncryptionDependencies {
  getKey(): Promise<string | null>;
  setKey(key: string): Promise<void>;
  randomBytes(): Promise<Uint8Array>;
  open(): Promise<SqlConnection>;
  databaseExists(): boolean;
}
const native: EncryptionDependencies = {
  getKey: () => SecureStore.getItemAsync(keyName, secureOptions),
  setKey: (key) => SecureStore.setItemAsync(keyName, key, secureOptions),
  randomBytes: () => Crypto.getRandomBytesAsync(32),
  open: () => SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }),
  databaseExists: () => new File(SQLite.defaultDatabaseDirectory, databaseName).exists,
};
/** Open a keyed SQLCipher database before any schema read or disk write. No plaintext fallback. */
export async function openEncryptedDatabase(deps = native): Promise<LocalDatabase> {
  let key = await deps.getKey();
  if (key === null) {
    if (deps.databaseExists()) throw new Error('E_LOCAL_KEY_MISSING');
    const bytes = await deps.randomBytes();
    if (bytes.length !== 32) throw new Error('E_LOCAL_KEY_INVALID');
    key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    // A failed SecureStore write must prevent database creation.
    await deps.setKey(key);
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('E_LOCAL_KEY_INVALID');
  const connection = await deps.open();
  try {
    // PRAGMA cannot bind parameters. Strict hex validation above prevents SQL injection.
    await connection.execAsync(`PRAGMA key = "x'${key}'"`);
    const cipher = await connection.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version');
    if (
      !cipher ||
      !Object.values(cipher).some((value) => typeof value === 'string' && value.length > 0)
    )
      throw new Error('E_LOCAL_CIPHER_UNAVAILABLE');
    // Wrong/lost key or corrupt file fails here; never delete or reset an existing database.
    await connection.getFirstAsync('SELECT count(*) FROM sqlite_master');
    await connection.execAsync(`
      PRAGMA cipher_memory_security = ON;
      PRAGMA foreign_keys = ON;
      PRAGMA secure_delete = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
    `);
    const database = new LocalDatabase(connection);
    await migrate(database);
    return database;
  } catch {
    await connection.closeAsync();
    // Native errors can include SQL or personal values; expose only a stable error code.
    throw new Error('E_LOCAL_DATABASE_UNAVAILABLE');
  }
}
