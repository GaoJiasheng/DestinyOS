import { LocalDatabase } from '../lib/data/database';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { fixtureReport } from '../lib/diagnostics/fixture';
import { pruneDailyOnce } from '../lib/daily/service';
import {
  clearJournalDraft,
  readJournalDraft,
  writeJournalDraft,
} from '../lib/daily/journal-drafts';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-00000000000b' }));

let database: LocalDatabase;
let clock = Date.parse('2026-10-07T00:00:00.000Z');
const now = () => new Date(clock);
const store = () => createLocalStore(database, null, () => `id-${clock}`, now);
const { chart, report } = fixtureReport('bazi', 'zh');
function reading(system: string, profileId: string | null, extra: object = {}) {
  return {
    profileId,
    profileVersion: profileId ? 1 : null,
    system,
    status: 'ok',
    inputSnapshot: {
      system,
      birth: A,
      locale: 'zh',
      idempotencyKey: '00000000-0000-4000-8000-000000000000',
      ...extra,
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
const daily = (date: string) => ({
  ...reading('daily', 'me'),
  chart: { date: { local: date } },
});
const day = (offset: number) =>
  new Date(Date.parse('2026-10-07T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
beforeEach(async () => {
  database = await testDatabase();
  clock = Date.parse('2026-10-07T00:00:00.000Z');
  const local = store();
  await local.profiles.save({ name: '我', birth: A, version: 1, isCurrent: true }, 'me');
  await local.profiles.save({ name: 'B', birth: A, version: 1, isCurrent: true }, 'other');
});
afterEach(async () => {
  await database.close();
});

it('lists real reports past 600 newer daily snapshots, filtered by profile in SQL', async () => {
  const local = store();
  for (const [i, id] of ['bazi-1', 'bazi-2', 'bazi-3'].entries()) {
    clock += 1000;
    await local.readings.save(reading('bazi', 'me'), id);
    if (i === 0) await local.readings.save(reading('bazi', 'other'), 'bazi-other');
  }
  clock += 1000;
  await local.readings.save(reading('iching', null), 'divination');
  clock += 1000;
  await local.readings.save(
    reading('synastry', 'other', { partnerProfileId: 'me', partnerBirth: A }),
    'pair',
  );
  for (let i = 0; i < 600; i++) {
    clock += 1000;
    await local.readings.save(daily(day(-(i % 80))), `daily-${i}`);
  }
  const page = await local.readings.listBySystem({ except: ['daily'], profileId: 'me' }, 50);
  expect(page.map((r) => r.id)).toEqual(['pair', 'divination', 'bazi-3', 'bazi-2', 'bazi-1']);
  expect(await local.readings.listBySystem({ only: ['vedic'] }, 1)).toEqual([]);
  // Offset pages by system: same-instant rows tie-break on id, so bazi-other sorts before bazi-1.
  expect((await local.readings.listBySystem({ only: ['bazi'] }, 50, 3)).map((r) => r.id)).toEqual([
    'bazi-1',
  ]);
  await expect(local.readings.listBySystem({}, 501)).rejects.toThrow('E_INVALID_INPUT');
  await expect(local.profiles.listBySystem({}, 1)).rejects.toThrow('E_INVALID_INPUT');
});

it('prunes daily snapshots outside the window but keeps journaled days and spared ids', async () => {
  const local = store();
  await local.readings.save(daily(day(-200)), 'old');
  await local.readings.save(daily(day(-150)), 'journaled');
  await local.readings.save(daily(day(-120)), 'on-screen');
  await local.readings.save(daily(day(-10)), 'recent');
  await local.readings.save(daily(day(400)), 'far-future');
  await local.readings.save(reading('bazi', 'me'), 'report');
  await database.write((sql) =>
    sql.runAsync(
      'INSERT INTO ReportFeedback(readingId,section,helpful,updatedAt) VALUES (?,?,?,?)',
      'old',
      'daily',
      1,
      '2026-10-07T00:00:00.000Z',
    ),
  );
  await local.saveJournal({
    profileId: 'me',
    date: day(-150),
    tz: 'UTC',
    mood: 3,
    text: '',
    prediction: {
      scores: { career: 60, wealth: 60, love: 60, health: 60, social: 60, overall: 60 },
      tz: 'UTC',
      profileVersion: 1,
      engineVersion: 'test',
    },
  });
  expect(await local.readings.pruneDaily(day(-90), day(31), ['on-screen'])).toBe(2);
  const left = (await local.readings.list(50)).map((r) => r.id).sort();
  expect(left).toEqual(['journaled', 'on-screen', 'recent', 'report']);
  // Hard delete: no tombstone that sync would push, and the vote is gone with it.
  expect(await local.readings.changes()).toHaveLength(4);
  const votes = await database.read((sql) =>
    sql.getAllAsync('SELECT * FROM ReportFeedback WHERE readingId=?', 'old'),
  );
  expect(votes).toEqual([]);
  await expect(local.readings.pruneDaily('bad', day(0))).rejects.toThrow();
});

it('runs the cleanup once per owner and never lets a failure escape', async () => {
  const failing = {
    readings: { userId: 'u-1', pruneDaily: jest.fn(async () => Promise.reject(new Error('x'))) },
  } as unknown as Parameters<typeof pruneDailyOnce>[0];
  await expect(pruneDailyOnce(failing, 'UTC')).resolves.toBe(0);
  // A failed attempt is retried on the next load.
  await expect(pruneDailyOnce(failing, 'UTC')).resolves.toBe(0);
  expect(failing.readings.pruneDaily).toHaveBeenCalledTimes(2);
  const ok = {
    readings: { userId: 'u-2', pruneDaily: jest.fn(async () => 3) },
  } as unknown as Parameters<typeof pruneDailyOnce>[0];
  await expect(pruneDailyOnce(ok, 'UTC', ['keep'])).resolves.toBe(3);
  await pruneDailyOnce(ok, 'UTC');
  expect(ok.readings.pruneDaily).toHaveBeenCalledTimes(1);
  expect(ok.readings.pruneDaily).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ['keep'],
  );
});

it('keeps unsaved journal drafts per profile and day until saved', () => {
  writeJournalDraft('me', '2026-10-07', { mood: 4, text: 'half' });
  expect(readJournalDraft('me', '2026-10-07')).toEqual({ mood: 4, text: 'half' });
  expect(readJournalDraft('me', '2026-10-06')).toBeUndefined();
  expect(readJournalDraft('other', '2026-10-07')).toBeUndefined();
  clearJournalDraft('me', '2026-10-07');
  expect(readJournalDraft('me', '2026-10-07')).toBeUndefined();
});
