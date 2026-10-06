import { LocalDatabase } from '../lib/data/database';
import { migrations, migrate } from '../lib/data/migrations';
import { createLocalStore } from '../lib/data/store';
import { ProfileSchema, SettingsSchema } from '../lib/data/models';
import { sqliteConnection, testDatabase } from './sqlite';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { fixtureReport } from '../lib/diagnostics/fixture';

let database: LocalDatabase;
let nextId = 0;
const now = () => new Date('2026-10-07T00:00:00.000Z');
const uuid = () => `test-${++nextId}`;
const profile = { name: '我', birth: A, version: 1, isCurrent: true };
const store = () => createLocalStore(database, null, uuid, now);
beforeEach(async () => {
  database = await testDatabase();
  nextId = 0;
});
afterEach(async () => {
  await database.close();
});
function reading(profileId: string | null = null) {
  const { chart, report } = fixtureReport('bazi', 'zh');
  return {
    profileId,
    profileVersion: profileId ? 1 : null,
    system: 'bazi',
    status: 'ok',
    inputSnapshot: {
      system: 'bazi',
      birth: A,
      locale: 'zh',
      idempotencyKey: '00000000-0000-4000-8000-000000000000',
    },
    chart,
    reportZh: report,
    reportEn: null,
    schoolUsed: {},
    engineVersion: report.engineVersion,
    interpretVersion: report.interpretVersion,
    knowledgeVersion: report.knowledgeVersion,
    title: null,
    isPublic: false,
  };
}
function journal(profileId: string) {
  return {
    profileId,
    date: '2026-10-07',
    mood: 4,
    text: '今天很顺利',
    tz: 'Asia/Shanghai',
    prediction: {
      scores: { career: 60, wealth: 60, love: 60, health: 60, social: 60, overall: 60 },
      tz: 'Asia/Shanghai',
      profileVersion: 1,
      engineVersion: 'test',
    },
  };
}
test('anonymous multi-profile edits retain archived versions and advance timestamps', async () => {
  const local = store();
  const me = await local.profiles.save(profile);
  const partner = await local.profiles.save({ ...profile, name: '伴侣' });
  const edited = await local.profiles.save({ ...profile, name: '我自己' }, me.id);
  expect(edited.data?.version).toBe(2);
  expect(edited.updatedAt > me.updatedAt).toBe(true);
  expect((await local.profiles.list()).map((row) => row.id).sort()).toEqual(
    [me.id, partner.id].sort(),
  );
  expect(
    await database.read((sql) => sql.getAllAsync('SELECT * FROM BirthProfileVersion')),
  ).toHaveLength(3);
  expect(await local.profiles.get(partner.id)).toEqual(partner);
});
test('anonymous report snapshots persist without authentication/network and tombstones redact content', async () => {
  const local = store();
  const saved = await local.readings.save(reading());
  expect((await local.readings.get(saved.id))?.data?.reportZh).toEqual(saved.data?.reportZh);
  await local.readings.delete(saved.id);
  expect(await local.readings.get(saved.id)).toBeNull();
  expect((await local.readings.changes())[0]).toMatchObject({ id: saved.id, data: null });
  expect((await local.readings.changes(saved.updatedAt))[0]?.deletedAt).not.toBeNull();
  await expect(local.readings.save(reading(), saved.id)).rejects.toThrow('E_LOCAL_DELETED');
});
test('journal revisions preserve prediction and reject duplicate dates/invalid moods', async () => {
  const local = store();
  const me = await local.profiles.save(profile);
  const first = await local.saveJournal(journal(me.id));
  const edited = await local.saveJournal({
    ...journal(me.id),
    mood: 2,
    text: '更新',
    prediction: { ...journal(me.id).prediction, engineVersion: 'new' },
  });
  expect(edited.id).toBe(first.id);
  expect(edited.data?.prediction.engineVersion).toBe('test');
  await expect(local.journal.save({ ...journal(me.id), mood: 6 })).rejects.toThrow();
  await expect(local.journal.save({ ...journal(me.id), date: '2026-02-30' })).rejects.toThrow();
  expect(await local.journal.list()).toHaveLength(1);
});
test('settings defaults, partial updates and active-profile selection persist', async () => {
  const local = store();
  const me = await local.profiles.save(profile);
  expect(SettingsSchema.parse({})).toMatchObject({
    dailyPushEnabled: true,
    dailyPushTime: '08:00',
    soundOn: false,
    hapticsOn: true,
  });
  await local.updateSettings({ activeProfileId: me.id, dailyPushTime: '09:30' });
  const record = await local.updateSettings({ locale: 'en' });
  expect(record.data).toMatchObject({
    locale: 'en',
    dailyPushTime: '09:30',
    activeProfileId: me.id,
  });
  await expect(local.updateSettings({ activeProfileId: 'missing' })).rejects.toThrow('E_FORBIDDEN');
});
test('profile deletion atomically redacts dependents, archives and selection; other profiles survive', async () => {
  const local = store();
  const me = await local.profiles.save(profile);
  const partner = await local.profiles.save(profile);
  await local.readings.save(reading(me.id));
  await local.saveJournal(journal(me.id));
  await local.updateSettings({ activeProfileId: me.id });
  await local.profiles.delete(me.id);
  expect(await local.readings.list()).toEqual([]);
  expect(await local.journal.list()).toEqual([]);
  expect((await local.settings.list())[0]?.data?.activeProfileId).toBeNull();
  expect(await local.profiles.get(partner.id)).not.toBeNull();
  expect(
    await database.read((sql) =>
      sql.getAllAsync('SELECT * FROM BirthProfileVersion WHERE profileId=?', me.id),
    ),
  ).toEqual([]);
});
test('owner scopes prevent accidental cross-account reads, writes, and sync', async () => {
  const anonymous = await store().profiles.save(profile);
  const account = createLocalStore(database, 'account', uuid, now);
  expect(await account.profiles.list()).toEqual([]);
  await expect(account.profiles.get(anonymous.id)).rejects.toThrow('E_FORBIDDEN');
  await expect(account.profiles.save(profile, anonymous.id)).rejects.toThrow('E_FORBIDDEN');
  await expect(account.readings.save(reading(anonymous.id))).rejects.toThrow('E_FORBIDDEN');
  await expect(store().profiles.applyRemote([])).rejects.toThrow('E_UNAUTHORIZED');
});
test('sync is atomic, later writes win, and equal timestamps prefer authoritative server', async () => {
  const account = createLocalStore(database, 'account', uuid, now);
  const first = await account.profiles.save(profile);
  await account.profiles.applyRemote([{ ...first, data: { ...first.data, name: 'server' } }]);
  expect((await account.profiles.get(first.id))?.data?.name).toBe('server');
  await account.profiles.applyRemote([{ ...first, updatedAt: '2026-10-06T00:00:00.000Z' }]);
  expect((await account.profiles.get(first.id))?.data?.name).toBe('server');
  await expect(
    account.profiles.applyRemote([
      { ...first, data: { ...first.data, name: 'rollback' } },
      { ...first, id: 'other', userId: 'intruder' },
    ]),
  ).rejects.toThrow('E_FORBIDDEN');
  expect((await account.profiles.get(first.id))?.data?.name).toBe('server');
  await account.profiles.applyRemote([
    {
      ...first,
      data: null,
      updatedAt: '2026-10-08T00:00:00.000Z',
      deletedAt: '2026-10-08T00:00:00.000Z',
    },
  ]);
  expect(await account.profiles.get(first.id)).toBeNull();
});
test('under-13 birth and malformed input never persist', async () => {
  await expect(store().profiles.save({ ...profile, birth: { ...A, year: 2020 } })).rejects.toThrow(
    'E_AGE_RESTRICTED',
  );
  await expect(store().profiles.save({ ...profile, birth: { ...A, day: 99 } })).rejects.toThrow();
  expect(await store().profiles.list()).toEqual([]);
  expect(ProfileSchema.parse(profile).birth).toEqual(A);
});
test('upgrades from v1, repeat migration, future-schema rejection, and rollback', async () => {
  const connection = sqliteConnection();
  await connection.execAsync(`${migrations[0]} PRAGMA user_version=1;`);
  const old = new LocalDatabase(connection);
  await migrate(old);
  await migrate(old);
  expect(await old.read((sql) => sql.getFirstAsync('PRAGMA user_version'))).toEqual({
    user_version: migrations.length,
  });
  await expect(
    old.write(async (sql) => {
      await sql.execAsync('CREATE TABLE rollback_test(id)');
      throw new Error('fail');
    }),
  ).rejects.toThrow('fail');
  expect(
    await old.read((sql) =>
      sql.getFirstAsync("SELECT name FROM sqlite_master WHERE name='rollback_test'"),
    ),
  ).toBeNull();
  await old.read((sql) => sql.execAsync('PRAGMA user_version=99'));
  await expect(migrate(old)).rejects.toThrow('E_LOCAL_SCHEMA_NEWER');
  await old.close();
});
test('serialized concurrent profile edits preserve every version; device erasure covers all accounts', async () => {
  const local = store();
  const me = await local.profiles.save(profile);
  await Promise.all([local.profiles.save(profile, me.id), local.profiles.save(profile, me.id)]);
  expect((await local.profiles.get(me.id))?.data?.version).toBe(3);
  const account = createLocalStore(database, 'account', uuid, now);
  await account.profiles.save(profile);
  await local.eraseDeviceData();
  expect(await local.profiles.list()).toEqual([]);
  expect(await account.profiles.list()).toEqual([]);
  expect(
    await database.read((sql) => sql.getAllAsync('SELECT * FROM BirthProfileVersion')),
  ).toEqual([]);
});
test('remote SQL failure rolls back earlier records in the same batch', async () => {
  const account = createLocalStore(database, 'account', uuid, now);
  const owned = await account.profiles.save(profile);
  const anonymous = await store().profiles.save(profile);
  await expect(
    account.profiles.applyRemote([
      { ...owned, data: { ...owned.data, name: 'must rollback' } },
      { ...owned, id: anonymous.id },
    ]),
  ).rejects.toThrow('E_FORBIDDEN');
  expect((await account.profiles.get(owned.id))?.data?.name).toBe(profile.name);
});
test('server profile tombstone redacts local dependent content and version history', async () => {
  const account = createLocalStore(database, 'account', uuid, now);
  const me = await account.profiles.save(profile);
  await account.readings.save(reading(me.id));
  await account.saveJournal(journal(me.id));
  await account.profiles.applyRemote([
    {
      ...me,
      data: null,
      updatedAt: '2026-10-08T00:00:00.000Z',
      deletedAt: '2026-10-08T00:00:00.000Z',
    },
  ]);
  expect((await account.readings.changes())[0]?.data).toBeNull();
  expect((await account.journal.changes())[0]?.data).toBeNull();
  expect(
    await database.read((sql) =>
      sql.getAllAsync('SELECT * FROM BirthProfileVersion WHERE profileId=?', me.id),
    ),
  ).toEqual([]);
});
test('concurrent settings patches and journal writes preserve uniqueness and future-day boundary', async () => {
  const local = store();
  await Promise.all([
    local.updateSettings({ dailyPushTime: '10:30' }),
    local.updateSettings({ locale: 'en' }),
  ]);
  expect((await local.settings.list())[0]?.data).toMatchObject({
    dailyPushTime: '10:30',
    locale: 'en',
  });
  const me = await local.profiles.save(profile);
  await Promise.all([
    local.saveJournal(journal(me.id)),
    local.saveJournal({ ...journal(me.id), mood: 1 }),
  ]);
  expect(await local.journal.list()).toHaveLength(1);
  expect((await local.journal.list())[0]?.data?.mood).toBe(1);
  await expect(local.saveJournal({ ...journal(me.id), date: '2026-10-08' })).rejects.toThrow(
    'E_DATE_OUT_OF_RANGE',
  );
});
