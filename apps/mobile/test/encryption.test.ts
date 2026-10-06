import { openEncryptedDatabase, type EncryptionDependencies } from '../lib/data/encryption';
import { sqliteConnection } from './sqlite';
import type { SqlConnection } from '../lib/data/database';

function dependencies(storedKey: string | null = null) {
  const calls: string[] = [];
  const sql = sqliteConnection();
  const connection: SqlConnection = {
    ...sql,
    async execAsync(query) {
      calls.push(query);
      await sql.execAsync(query);
    },
    async getFirstAsync<T>(query: string) {
      calls.push(query);
      return query === 'PRAGMA cipher_version'
        ? ({ cipher_version: '4.6.1' } as T)
        : sql.getFirstAsync<T>(query);
    },
  };
  const deps: EncryptionDependencies = {
    getKey: jest.fn(async () => storedKey),
    setKey: jest.fn(async (key) => {
      storedKey = key;
    }),
    randomBytes: jest.fn(async () => new Uint8Array(32).fill(42)),
    open: jest.fn(async () => connection),
    databaseExists: () => false,
  };
  return { deps, calls, connection };
}
test('persist 256-bit key before opening and key before all SQL; reuse same key after restart', async () => {
  const { deps, calls } = dependencies();
  const database = await openEncryptedDatabase(deps);
  expect(deps.setKey).toHaveBeenCalledWith('2a'.repeat(32));
  expect(calls[0]).toBe(`PRAGMA key = "x'${'2a'.repeat(32)}'"`);
  expect(calls[1]).toBe('PRAGMA cipher_version');
  expect(calls.findIndex((query) => query.includes('CREATE TABLE'))).toBeGreaterThan(1);
  await database.close();
  const reopened = dependencies('2a'.repeat(32));
  await (await openEncryptedDatabase(reopened.deps)).close();
  expect(reopened.deps.randomBytes).not.toHaveBeenCalled();
  expect(reopened.deps.setKey).not.toHaveBeenCalled();
});
test('SecureStore failure or malformed key prevents database creation', async () => {
  const { deps, connection } = dependencies();
  deps.setKey = jest.fn(async () => {
    throw new Error('keystore unavailable');
  });
  await expect(openEncryptedDatabase(deps)).rejects.toThrow();
  expect(deps.open).not.toHaveBeenCalled();
  await connection.closeAsync();
  const invalid = dependencies("';DROP TABLE BirthProfile;");
  await expect(openEncryptedDatabase(invalid.deps)).rejects.toThrow('E_LOCAL_KEY_INVALID');
  expect(invalid.deps.open).not.toHaveBeenCalled();
  await invalid.connection.closeAsync();
});
test('lost key with existing file never regenerates key or resets data', async () => {
  const { deps, connection } = dependencies();
  deps.databaseExists = () => true;
  await expect(openEncryptedDatabase(deps)).rejects.toThrow('E_LOCAL_KEY_MISSING');
  expect(deps.setKey).not.toHaveBeenCalled();
  expect(deps.open).not.toHaveBeenCalled();
  await connection.closeAsync();
});
test('plaintext SQLite and wrong keys fail closed and release the connection', async () => {
  const { deps, connection } = dependencies('ab'.repeat(32));
  connection.getFirstAsync = async () => null;
  const close = jest.spyOn(connection, 'closeAsync');
  await expect(openEncryptedDatabase(deps)).rejects.toThrow('E_LOCAL_DATABASE_UNAVAILABLE');
  expect(close).toHaveBeenCalled();
  const wrong = dependencies('ab'.repeat(32));
  wrong.connection.getFirstAsync = async <T>(query: string) => {
    if (query !== 'PRAGMA cipher_version') throw new Error('file is not a database');
    return { cipher_version: '4' } as T;
  };
  await expect(openEncryptedDatabase(wrong.deps)).rejects.toThrow('E_LOCAL_DATABASE_UNAVAILABLE');
});
