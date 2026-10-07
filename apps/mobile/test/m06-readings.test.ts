import { randomUUID as mockRandomUUID } from 'node:crypto';
import { LocalDatabase } from '../lib/data/database';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import {
  createNativeReading,
  loadNativeReading,
  reportSystems,
  readingError,
} from '../lib/reports/readings';
import { getFeedback, saveFeedback } from '../lib/reports/feedback';
import { bundledKnowledge as mockBundledKnowledge } from '../lib/knowledge/bundled';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../packages/engine/test/fixtures/birth/B.json';
let mockStore: ReturnType<typeof createLocalStore>;
jest.mock('../lib/data/store', () => ({
  ...jest.requireActual<typeof import('../lib/data/store')>('../lib/data/store'),
  getLocalStore: () => Promise.resolve(mockStore),
}));
jest.mock('../lib/knowledge', () => ({ getOfflineKnowledge: async () => mockBundledKnowledge() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));
let database: LocalDatabase;
beforeEach(async () => {
  database = await testDatabase();
  mockStore = createLocalStore(database);
});
afterEach(async () => {
  await database.close();
});
test('all report systems persist bilingual snapshots and replay without computing a new chart', async () => {
  const a = await mockStore.profiles.save({ name: 'A', birth: A, version: 1, isCurrent: true });
  const b = await mockStore.profiles.save({ name: 'B', birth: B, version: 1, isCurrent: true });
  for (const system of reportSystems) {
    const saved = await createNativeReading(
      system,
      a,
      system === 'synastry' ? b : undefined,
      '2026-10-04T04:00:00.000Z',
    );
    expect(saved.data?.reportZh).not.toBeNull();
    expect(saved.data?.reportEn).not.toBeNull();
    const zh = await loadNativeReading(saved.id, system, 'zh'),
      en = await loadNativeReading(saved.id, system, 'en'),
      tw = await loadNativeReading(saved.id, system, 'zh-TW');
    expect(zh?.report.locale).toBe('zh');
    expect(en?.report.locale).toBe('en');
    expect(tw?.report.locale).toBe('zh-TW');
    expect(en?.chart).toEqual(zh?.chart);
    expect(tw?.report.hits).toEqual(zh?.report.hits);
    expect(en?.report.headline.persona).not.toBe(zh?.report.headline.persona);
    expect(
      await loadNativeReading(saved.id, system === 'bazi' ? 'ziwei' : 'bazi', 'zh'),
    ).toBeNull();
  }
});
test('reports detect profile edits, validate corrupted data and fill missing locales only', async () => {
  const profile = await mockStore.profiles.save({
    name: 'A',
    birth: A,
    version: 1,
    isCurrent: true,
  });
  const reading = await createNativeReading('bazi', profile, undefined, '2026-10-04T04:00:00.000Z');
  await mockStore.profiles.save({ ...profile.data!, birth: { ...A, day: 16 } }, profile.id);
  expect((await loadNativeReading(reading.id, 'bazi', 'zh'))?.stale).toBe(true);
  await mockStore.readings.save({ ...reading.data!, reportEn: null }, reading.id);
  const replay = await loadNativeReading(reading.id, 'bazi', 'en');
  expect(replay?.chart.data).toEqual(reading.data?.chart);
  expect((await mockStore.readings.get(reading.id))?.data?.reportZh).toEqual(
    reading.data?.reportZh,
  );
  await mockStore.readings.save({ ...reading.data!, reportZh: { invalid: true } }, reading.id);
  await expect(loadNativeReading(reading.id, 'bazi', 'zh')).rejects.toThrow('E_INVALID_INPUT');
  expect(await loadNativeReading('missing', 'bazi', 'zh')).toBeNull();
});
test('feedback survives reload, replaces a prior vote, rejects foreign records and is erased with reports', async () => {
  const reading = await createNativeReading('tarot', null, undefined, '2026-10-04T04:00:00.000Z');
  await saveFeedback(reading.id, 'overview', true);
  expect(await getFeedback(reading.id)).toEqual({ overview: true });
  await saveFeedback(reading.id, 'overview', false);
  expect(await getFeedback(reading.id)).toEqual({ overview: false });
  await expect(saveFeedback('foreign', 'overview', true)).rejects.toThrow('E_FORBIDDEN');
  await mockStore.readings.delete(reading.id);
  expect(await getFeedback(reading.id)).toEqual({});
  const rows = await database.read((sql) => sql.getAllAsync('SELECT * FROM ReportFeedback'));
  expect(rows).toEqual([]);
  await mockStore.eraseDeviceData();
});
test('public errors contain documented codes and never include sensitive input', () => {
  expect(readingError({ code: 'E_REQUIRES_BIRTH_TIME', details: A })).toBe(
    'engine.errors.E_REQUIRES_BIRTH_TIME',
  );
  expect(readingError(new Error(JSON.stringify(A)))).toBe('mobile.storage.error');
});

test('deleting either synastry partner erases the dual snapshot but preserves unrelated reports', async () => {
  const a = await mockStore.profiles.save({ name: 'A', birth: A, version: 1, isCurrent: true });
  const b = await mockStore.profiles.save({ name: 'B', birth: B, version: 1, isCurrent: true });
  const pair = await createNativeReading('synastry', a, b);
  const single = await createNativeReading('bazi', a);
  await mockStore.profiles.delete(b.id);
  expect(await mockStore.readings.get(pair.id)).toBeNull();
  expect(await mockStore.readings.get(single.id)).not.toBeNull();
  expect((await mockStore.readings.changes()).find((item) => item.id === pair.id)?.data).toBeNull();
});
test('synastry rejects the same profile and foreign partner identities before persisting', async () => {
  const a = await mockStore.profiles.save({ name: 'A', birth: A, version: 1, isCurrent: true });
  await expect(createNativeReading('synastry', a, a)).rejects.toThrow();
  await expect(createNativeReading('synastry', a, { ...a, id: 'foreign' })).rejects.toThrow(
    'E_FORBIDDEN',
  );
  expect(await mockStore.readings.list()).toHaveLength(0);
});
