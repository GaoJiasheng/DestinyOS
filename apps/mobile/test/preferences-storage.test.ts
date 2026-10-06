import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptedPreferencesStorage } from '../lib/data/preferences-storage';
import { getLocalStore, createLocalStore } from '../lib/data/store';
import type { LocalDatabase } from '../lib/data/database';
import { testDatabase } from './sqlite';
jest.unmock('../lib/data/preferences-storage');
jest.mock('../lib/data/store', () => {
  const actual: typeof import('../lib/data/store') = jest.requireActual('../lib/data/store');
  return { ...actual, getLocalStore: jest.fn() };
});
let database: LocalDatabase;
let local: ReturnType<typeof createLocalStore>;
beforeEach(async () => {
  database = await testDatabase();
  let id = 0;
  local = createLocalStore(database, null, () => `preferences-${++id}`);
  jest.mocked(getLocalStore).mockResolvedValue(local);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.removeItem).mockClear();
});
afterEach(async () => {
  await database.close();
});
test('one-time legacy migration writes encrypted settings before removing AsyncStorage copy', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValue(JSON.stringify({ state: { theme: 'west', locale: 'en' }, version: 0 }));
  expect(JSON.parse(String(await encryptedPreferencesStorage.getItem('unused')))).toEqual({
    state: { theme: 'west', locale: 'en' },
    version: 0,
  });
  expect((await local.settings.list())[0]?.data).toMatchObject({
    theme: 'west',
    locale: 'en',
    dailyPushTime: '08:00',
  });
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tianji-ui-preferences');
});
test('projection changes preserve native settings and never write AsyncStorage', async () => {
  await local.updateSettings({ dailyPushTime: '11:30', hapticsOn: false });
  await encryptedPreferencesStorage.setItem(
    'unused',
    JSON.stringify({ state: { theme: 'east', locale: 'zh-TW' }, version: 0 }),
  );
  expect((await local.settings.list())[0]?.data).toMatchObject({
    locale: 'zh-TW',
    dailyPushTime: '11:30',
    hapticsOn: false,
  });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
test('malformed legacy data is ignored; a storage failure preserves legacy copy', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('{bad');
  expect(await encryptedPreferencesStorage.getItem('unused')).toBeNull();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  jest.mocked(getLocalStore).mockRejectedValueOnce(new Error('keychain unavailable'));
  await expect(encryptedPreferencesStorage.getItem('unused')).rejects.toThrow(
    'keychain unavailable',
  );
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});
