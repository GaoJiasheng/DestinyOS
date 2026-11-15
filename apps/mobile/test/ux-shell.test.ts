import { TolerantRepository } from '../lib/data/tolerant-repository';
import { ProfileSchema } from '../lib/data/models';
import { localeFromTag } from '../lib/preferences';
import { nextProbeDelay } from '../components/connectivity-bootstrap';
import { safeReturnTo } from '../lib/return-to';
import { testDatabase } from './sqlite';
import A from '../../../packages/engine/test/fixtures/birth/A.json';

it('skips a damaged profile row instead of failing the whole list, without deleting it', async () => {
  const database = await testDatabase();
  let next = 0;
  const skipped = jest.fn();
  const profiles = new TolerantRepository(
    database,
    'BirthProfile',
    null,
    ProfileSchema,
    () => `profile-${++next}`,
    () => new Date('2026-10-07T00:00:00.000Z'),
    skipped,
  );
  await profiles.save({ name: 'Good', birth: A, version: 1, isCurrent: true });
  await database.write((sql) =>
    sql.runAsync(
      'INSERT INTO BirthProfile(id,userId,data,createdAt,updatedAt,deletedAt) VALUES(?,?,?,?,?,?)',
      'broken',
      null,
      '{"name":',
      '2026-10-07T00:00:01.000Z',
      '2026-10-07T00:00:01.000Z',
      null,
    ),
  );
  const list = await profiles.list(500);
  expect(list.map((row) => row.id)).toEqual(['profile-1']);
  expect(skipped).toHaveBeenCalledWith('BirthProfile');
  const kept = await database.read((sql) =>
    sql.getFirstAsync<{ id: string }>('SELECT id FROM BirthProfile WHERE id=?', 'broken'),
  );
  expect(kept?.id).toBe('broken');
  await database.close();
});
it.each([
  ['zh-Hans-CN', 'zh'],
  ['zh_CN', 'zh'],
  ['zh-Hant-TW', 'zh-TW'],
  ['zh-HK', 'zh-TW'],
  ['zh-TW', 'zh-TW'],
  ['en-US', 'en'],
  ['ja-JP', 'en'],
  [undefined, 'en'],
] as const)('maps the system language %s to the %s catalog', (tag, locale) => {
  expect(localeFromTag(tag)).toBe(locale);
});
it('polls health slowly when reachable and backs off after failures', () => {
  expect(nextProbeDelay(true, 0)).toBe(60000);
  expect(nextProbeDelay(false, 1)).toBe(15000);
  expect(nextProbeDelay(false, 2)).toBe(30000);
  expect(nextProbeDelay(false, 10)).toBe(120000);
});
it('accepts only in-app return paths after sign-in', () => {
  expect(safeReturnTo('/bazi/r/abc')).toBe('/bazi/r/abc');
  expect(safeReturnTo('/r/abc/chat')).toBe('/r/abc/chat');
  for (const value of ['//evil.example', 'https://evil.example', '/auth/login', 'me', '/x\\y', 7])
    expect(safeReturnTo(value)).toBeUndefined();
});
