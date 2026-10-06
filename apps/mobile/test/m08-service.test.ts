import { Temporal } from '@js-temporal/polyfill';
import { BirthInputSchema, type DailyChart } from '@tianji/shared';
import { journalStats } from '@tianji/ui-core/journal-stats';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { createLocalStore, getLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import {
  loadDaily,
  monthDays,
  profileJournal,
  todayIn,
  dailyDate,
  hasVedicHistory,
} from '../lib/daily/service';
import { getFeedback, saveFeedback } from '../lib/reports/feedback';
import { shareLines } from '../lib/daily/share-lines';
import { knowledge as mockKnowledge } from '../lib/diagnostics/fixture';
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000008'),
}));
jest.mock('../lib/data/store', () => ({
  ...jest.requireActual<object>('../lib/data/store'),
  getLocalStore: jest.fn(),
}));
jest.mock('../lib/knowledge', () => ({ getOfflineKnowledge: async () => mockKnowledge.daily }));
let store: ReturnType<typeof createLocalStore>;
beforeEach(async () => {
  store = createLocalStore(
    await testDatabase(),
    null,
    () => 'journal-1',
    () => new Date('2026-10-08T00:00:00Z'),
  );
  jest.mocked(getLocalStore).mockResolvedValue(store);
});
afterEach(async () => {
  await store.database.close();
});
it('uses explicit zones across DST and rejects invalid routed dates', () => {
  expect(todayIn('America/New_York', '2026-03-08T06:30:00Z')).toBe('2026-03-08');
  expect(todayIn('Asia/Tokyo', '2026-10-04T23:30:00Z')).toBe('2026-10-05');
  expect(todayIn('America/New_York', '2026-10-04T23:30:00Z')).toBe('2026-10-04');
  expect(dailyDate('2026-02-30', 'UTC')).toBe(todayIn('UTC'));
});
it('keeps refresh deterministic, matches every heatmap score and leaves sample out of personal storage', async () => {
  const profile = await store.profiles.save(
    { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
    'a',
  );
  const first = await loadDaily(profile, '2026-10-04', 'America/New_York', 'zh');
  const second = await loadDaily(profile, '2026-10-04', 'America/New_York', 'en');
  expect(first.chart).toEqual(second.chart);
  expect(first.id).toBe(second.id);
  expect(first.report.locale).toBe('zh');
  expect(second.report.locale).toBe('en');
  const range = monthDays(profile, '2026-10', 'America/New_York', 'en');
  expect(range.find((d) => d.date === '2026-10-04')?.scores).toEqual(first.chart.scores);
  await saveFeedback(first.id!, 'daily', true);
  await loadDaily(profile, '2026-10-04', 'America/New_York', 'zh');
  expect(await getFeedback(first.id!)).toEqual({ daily: true });
  expect(await store.readings.list()).toHaveLength(1);
  const sample = await loadDaily(null, '2026-10-04', 'UTC', 'en');
  expect(sample.id).toBeNull();
  expect(await store.readings.list()).toHaveLength(1);
}, 30000);
it('keeps the first prediction when editing, scopes journals by profile, and deletes related daily votes', async () => {
  const a = await store.profiles.save(
    { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
    'a',
  );
  await store.profiles.save(
    { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
    'b',
  );
  const daily = await loadDaily(a, '2026-10-04', 'Asia/Shanghai', 'zh');
  const prediction = {
    scores: daily.chart.scores,
    tz: 'Asia/Shanghai',
    profileVersion: 1,
    engineVersion: daily.engineVersion,
  };
  await store.saveJournal({
    profileId: 'a',
    date: '2026-10-04',
    tz: 'Asia/Shanghai',
    mood: 3,
    text: 'private',
    prediction,
  });
  await store.saveJournal({
    profileId: 'a',
    date: '2026-10-04',
    tz: 'Asia/Shanghai',
    mood: 4,
    text: 'revised',
    prediction: { ...prediction, scores: { ...prediction.scores, overall: 95 } },
  });
  const entries = await profileJournal('a');
  expect(entries).toHaveLength(1);
  expect(entries[0]?.data?.prediction).toEqual(prediction);
  expect(entries[0]?.data?.text).toBe('revised');
  expect(await profileJournal('b')).toHaveLength(0);
  await expect(
    store.saveJournal({
      profileId: 'a',
      date: '2026-10-09',
      tz: 'Asia/Shanghai',
      mood: 4,
      text: 'future',
      prediction,
    }),
  ).rejects.toThrow('E_DATE_OUT_OF_RANGE');
  await saveFeedback(daily.id!, 'daily', false);
  await store.profiles.delete('a');
  expect(await profileJournal('a')).toEqual([]);
  expect(await store.readings.get(daily.id!)).toBeNull();
  expect(await getFeedback(daily.id!)).toEqual({});
}, 30000);
it('uses saved moods and signed correlation, including ties, DST-free streaks and insufficient samples', () => {
  const samples = [1, 2, 3].map((n) => ({
    date: Temporal.PlainDate.from('2026-03-07')
      .add({ days: n - 1 })
      .toString(),
    mood: n,
    prediction: {
      scores: {
        career: n * 20,
        wealth: n * 20,
        love: n * 20,
        health: n * 20,
        social: n * 20,
        overall: n * 20,
      } as DailyChart['scores'],
      tz: 'America/New_York',
      profileVersion: 1,
      engineVersion: 'test',
    },
  }));
  const stats = journalStats(samples, '2026-03-10');
  expect(stats.correlation).toBeCloseTo(1);
  expect(stats.streak).toBe(3);
  expect(stats.longestStreak).toBe(3);
  expect(journalStats(samples.slice(0, 2), '2026-03-12').correlation).toBeNull();
  expect(journalStats(samples, '2026-03-12').streak).toBe(0);
});

it('keeps sharing disclaimer words readable while fitting English and Chinese in measured card bounds', () => {
  const text = 'For entertainment and reflection only. Not professional advice.';
  const lines = shareLines(text, 'en', (s) => s.length, 55);
  expect(lines.join(' ')).toBe(text);
  expect(lines.at(-1)).toBe('advice.');
  expect(lines.every((s) => s.length <= 55)).toBe(true);
  expect(shareLines('天机读懂你的时间与星辰', 'zh', (s) => s.length, 4).join('')).toBe(
    '天机读懂你的时间与星辰',
  );
  expect(shareLines('abcdefghijkl', 'en', (s) => s.length, 4)).toEqual(['abcd', 'efgh', 'ijkl']);
});

it('keeps prior Vedic use visible beyond the first 500 owner-scoped readings', async () => {
  const profile = await store.profiles.save(
    { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
    'a',
  );
  const daily = await loadDaily(profile, '2026-10-04', 'UTC', 'zh');
  const record = (await store.readings.get(daily.id!))!;
  const list = jest.spyOn(store.readings, 'list');
  list.mockResolvedValueOnce(
    Array.from({ length: 500 }, (_, i) => ({ ...record, id: `old-${i}` })),
  );
  list.mockResolvedValueOnce([{ ...record, data: { ...record.data!, system: 'vedic' } }]);
  expect(await hasVedicHistory()).toBe(true);
  expect(list).toHaveBeenLastCalledWith(500, 500);
});
