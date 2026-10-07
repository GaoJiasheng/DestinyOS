jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import { anonymousCount, mergeAnonymous, applyItems, synchronize } from '../lib/account/sync';
import { SessionManager } from '../lib/account/session';
import type { MobileTokens } from '@tianji/api-client';
import { createAccountMock } from '../lib/account/mock';
import { fixtureReport } from '../lib/diagnostics/fixture';
const pair: MobileTokens = {
  accessToken: 'a'.repeat(43),
  refreshToken: 'r'.repeat(43),
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshExpiresIn: 5184000,
  sessionId: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
  userId: 'alice',
};
it('synchronizes imported anonymous data against the Maestro identity server', async () => {
  const database = await testDatabase();
  try {
    const account = createLocalStore(database, 'M10-mock-user');
    const mock = createAccountMock(
      undefined,
      async (id) => (await account.readings.get(id))?.data ?? null,
    );
    const tokens = await mock.provider();
    const manager = new SessionManager(
      { read: async () => null, write: async () => {}, remove: async () => {} },
      mock.fetcher,
    );
    await manager.accept(tokens);
    const anonymous = createLocalStore(database);
    await anonymous.profiles.save({ name: '', birth: A, version: 1, isCurrent: true });
    await anonymous.journal.save({
      profileId: (await anonymous.profiles.list())[0]!.id,
      date: '2026-10-07',
      mood: 3,
      text: '',
      tz: 'Asia/Shanghai',
      prediction: {
        scores: { overall: 50, career: 50, love: 50, wealth: 50, health: 50, social: 50 },
        tz: 'Asia/Shanghai',
        profileVersion: 1,
        engineVersion: 'mock',
      },
    });
    await anonymous.updateSettings({ onboardingVersion: 1 });
    await mergeAnonymous(anonymous, tokens.userId);
    const profile = (await account.profiles.list())[0]!;
    const fixture = fixtureReport('bazi', 'zh');
    await account.readings.save({
      profileId: profile.id,
      profileVersion: 1,
      system: 'daily',
      status: 'ok',
      inputSnapshot: {
        system: 'daily',
        birth: A,
        idempotencyKey: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
      },
      chart: fixture.chart,
      reportZh: fixture.report,
      reportEn: null,
      schoolUsed: {},
      engineVersion: 'mock',
      interpretVersion: 'mock',
      knowledgeVersion: 'mock',
      title: null,
      isPublic: false,
    });
    const saved = await account.readings.save({
      profileId: profile.id,
      profileVersion: 1,
      system: 'bazi',
      status: 'ok',
      inputSnapshot: {
        system: 'bazi',
        birth: A,
        profileId: profile.id,
        locale: 'zh',
        options: {},
        idempotencyKey: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
      },
      chart: fixture.chart,
      reportZh: fixture.report,
      reportEn: null,
      schoolUsed: {},
      engineVersion: 'mock',
      interpretVersion: 'mock',
      knowledgeVersion: 'mock',
      title: 'Fixture report',
      isPublic: false,
    });
    await synchronize(manager, 'zh', account);
    expect((await account.profiles.list())[0]?.data?.isDefault).toBe(true);
    expect((await account.settings.list())[0]?.data?.onboardingVersion).toBe(1);
    expect((await account.journal.list())[0]?.data).toMatchObject({
      profileId: profile.id,
      date: '2026-10-07',
      prediction: { scores: { overall: 50 }, profileVersion: 1 },
    });
    expect((await account.readings.list()).some((row) => row.data?.system === 'daily')).toBe(true);
    expect((await account.readings.get(saved.id))?.data).toMatchObject({
      chart: fixture.chart,
      reportZh: fixture.report,
      profileId: profile.id,
      profileVersion: 1,
      title: 'Fixture report',
    });
  } finally {
    await database.close();
  }
});
it('requires confirmation before import, rekeys owned data, and keeps rejected anonymous content isolated', async () => {
  const database = await testDatabase();
  try {
    const anonymous = createLocalStore(database),
      account = createLocalStore(database, 'alice');
    const saved = await anonymous.profiles.save({
      name: 'Alice',
      birth: A,
      version: 1,
      isCurrent: true,
    });
    await anonymous.updateSettings({ activeProfileId: saved.id, onboardingVersion: 1 });
    expect(await anonymousCount(anonymous)).toBe(1);
    expect(await account.profiles.list()).toHaveLength(0);
    await mergeAnonymous(anonymous, 'alice');
    const imported = (await account.profiles.list())[0]!;
    expect(imported.id).not.toBe(saved.id);
    expect(imported.data?.birth).toEqual(BirthInputSchema.parse(A));
    expect((await account.settings.list())[0]?.data?.activeProfileId).toBe(imported.id);
    expect(await anonymousCount(anonymous)).toBe(0);
    expect((await anonymous.settings.list())[0]?.data?.onboardingVersion).toBe(1);
    expect(await createLocalStore(database, 'bob').profiles.list()).toHaveLength(0);
  } finally {
    await database.close();
  }
});
it('preserves newer offline edits, prefers the server on ties, and applies terminal profile tombstones to all versions', async () => {
  const database = await testDatabase();
  try {
    const store = createLocalStore(
      database,
      'alice',
      () => 'profile',
      () => new Date('2026-10-07T01:00:00Z'),
    );
    await store.profiles.save({ name: 'Offline', birth: A, version: 1, isCurrent: true });
    const item = {
      id: 'profile',
      updatedAt: '2026-10-07T00:00:00Z',
      deleted: false as const,
      birth: BirthInputSchema.parse(A),
      metadata: { label: 'Cloud', relation: 'family' as const },
      version: 1,
      isDefault: true,
    };
    await applyItems(store, 'profiles', [item]);
    expect((await store.profiles.get('profile'))?.data?.name).toBe('Offline');
    await applyItems(store, 'profiles', [{ ...item, updatedAt: '2026-10-07T01:00:00Z' }]);
    expect((await store.profiles.get('profile'))?.data?.name).toBe('Cloud');
    await store.profiles.save(
      { name: 'Cloud edited offline', birth: A, version: 1, isCurrent: true },
      'profile',
    );
    expect((await store.profiles.get('profile'))?.data).toMatchObject({
      relation: 'family',
      isDefault: true,
    });
    await applyItems(store, 'profiles', [
      { id: 'profile', updatedAt: '2026-10-07T00:00:00Z', deleted: true },
    ]);
    expect(await store.profiles.get('profile')).toBeNull();
    const versions = await database.read((sql) =>
      sql.getAllAsync('SELECT * FROM BirthProfileVersion'),
    );
    expect(versions).toEqual([]);
  } finally {
    await database.close();
  }
});
it('pulls pagination and persists cursors only after successful application; deletes only the selected account cache', async () => {
  const database = await testDatabase();
  try {
    const store = createLocalStore(database, 'alice'),
      other = createLocalStore(database, 'bob');
    await other.profiles.save({ name: 'Bob', birth: A, version: 1, isCurrent: true });
    const requests: string[] = [];
    const fetcher: typeof fetch = async (input, options) => {
      const url = new URL(String(input));
      requests.push(url.pathname + url.search);
      const resource = url.pathname.split('/').at(-1);
      const data =
        options?.method === 'PUT'
          ? { items: [] }
          : resource === 'profiles' && !url.search
            ? {
                items: [
                  {
                    id: 'cloud-profile',
                    updatedAt: '2026-10-07T00:00:00Z',
                    deleted: false,
                    birth: A,
                    metadata: { label: 'Cloud', relation: 'self' },
                    version: 1,
                    isDefault: true,
                  },
                ],
                cursor: 'next',
                hasMore: true,
              }
            : { items: [], cursor: 'done', hasMore: false };
      return new Response(JSON.stringify({ ok: true, data }));
    };
    const manager = new SessionManager(
      { read: async () => null, write: async () => {}, remove: async () => {} },
      fetcher,
    );
    await manager.accept(pair);
    await synchronize(manager, 'en', store);
    expect(requests).toContain('/api/v1/mobile/sync/profiles?since=next');
    expect((await store.profiles.list())[0]?.data?.name).toBe('Cloud');
    const cursors = await database.read((sql) =>
      sql.getAllAsync<{ cursor: string }>(
        'SELECT cursor FROM MobileSyncState WHERE userId=?',
        'alice',
      ),
    );
    expect(cursors).toHaveLength(4);
    expect(cursors.every((row) => row.cursor === 'done')).toBe(true);
    await store.eraseAccountData();
    expect(await store.profiles.list()).toEqual([]);
    expect(await other.profiles.list()).toHaveLength(1);
  } finally {
    await database.close();
  }
});
