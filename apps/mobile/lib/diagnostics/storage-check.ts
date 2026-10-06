import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { openEncryptedDatabase, type EncryptionDependencies } from '../data/encryption';
import { createLocalStore } from '../data/store';
import { bundledKnowledge } from '../knowledge/bundled';
import { KnowledgeCache } from '../knowledge/cache';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';

/** Native acceptance uses an isolated encrypted DB and ephemeral SecureStore key, never user data. */
export async function checkNativeStorage() {
  const name = `m04-${Crypto.randomUUID()}.db`,
    keyId = `tianji.m04.${Crypto.randomUUID()}`;
  const keyOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  const deps: EncryptionDependencies = {
    getKey: () => SecureStore.getItemAsync(keyId, keyOptions),
    setKey: (key) => SecureStore.setItemAsync(keyId, key, keyOptions),
    randomBytes: () => Crypto.getRandomBytesAsync(32),
    open: () => SQLite.openDatabaseAsync(name, { useNewConnection: true }),
    databaseExists: () => new File(SQLite.defaultDatabaseDirectory, name).exists,
  };
  let database = await openEncryptedDatabase(deps);
  try {
    const store = createLocalStore(database);
    const offlineKnowledge = await new KnowledgeCache(database, bundledKnowledge()).load();
    const bundledSystems = new Set(offlineKnowledge.units.map((unit) => unit.system)).size;
    const knowledgeOffline =
      bundledSystems === 11 && offlineKnowledge.units.every((unit) => unit.zh.body && unit.en.body);
    const profile = await store.profiles.save({
      name: 'M04-PRIVATE-MARKER',
      birth: A,
      version: 1,
      isCurrent: true,
    });
    await store.updateSettings({ locale: 'en', activeProfileId: profile.id });
    await database.read((sql) => sql.execAsync('PRAGMA wal_checkpoint(TRUNCATE)'));
    await database.close();
    const bytes = await new File(SQLite.defaultDatabaseDirectory, name).bytes();
    const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    const encryptedAtRest =
      !raw.startsWith('SQLite format 3') && !raw.includes('M04-PRIVATE-MARKER');
    const wrong = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
    let wrongKeyRejected = false;
    try {
      await wrong.execAsync(`PRAGMA key = "x'${'00'.repeat(32)}'"`);
      await wrong.getFirstAsync('SELECT count(*) FROM sqlite_master');
    } catch {
      wrongKeyRejected = true;
    } finally {
      await wrong.closeAsync();
    }
    database = await openEncryptedDatabase(deps);
    const reopened = createLocalStore(database);
    const profilePersisted =
      (await reopened.profiles.get(profile.id))?.data?.name === 'M04-PRIVATE-MARKER';
    const settingsPersisted =
      (await reopened.settings.list(1))[0]?.data?.activeProfileId === profile.id;
    const cipher = await database.read((sql) => sql.getFirstAsync('PRAGMA cipher_version'));
    await reopened.profiles.delete(profile.id);
    const deleted =
      (await reopened.profiles.get(profile.id)) === null &&
      (await reopened.profiles.changes())[0]?.data === null;
    const result = {
      cipher,
      encryptedAtRest,
      wrongKeyRejected,
      profilePersisted,
      settingsPersisted,
      deleted,
      bundledSystems,
      knowledgeOffline,
      hermes: 'HermesInternal' in globalThis,
      passed:
        encryptedAtRest &&
        wrongKeyRejected &&
        profilePersisted &&
        settingsPersisted &&
        deleted &&
        knowledgeOffline,
    };
    new File(Paths.document, 'M04-storage.json').write(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await database.close();
    await SQLite.deleteDatabaseAsync(name);
    await SecureStore.deleteItemAsync(keyId, keyOptions);
  }
}
