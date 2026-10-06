import { randomUUID as mockRandomUUID } from 'node:crypto';
import { compute } from '@tianji/engine';
import { LocalDatabase } from '../lib/data/database';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import { createNativeReading, loadNativeReading } from '../lib/reports/readings';
import { bundledKnowledge as mockBundledKnowledge } from '../lib/knowledge/bundled';
import type { RitualInput } from '../lib/rituals/model';
let mockStore: ReturnType<typeof createLocalStore>;
jest.mock('../lib/data/store', () => ({
  ...jest.requireActual<typeof import('../lib/data/store')>('../lib/data/store'),
  getLocalStore: async () => mockStore,
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
it('saves actual ritual inputs, bilingual reports and exactly the preview chart; retries reuse one record', async () => {
  const now = '2026-10-04T12:00:00+08:00[Asia/Singapore]';
  const cases: { system: 'tarot' | 'iching' | 'qimen'; input: RitualInput }[] = [
    {
      system: 'tarot',
      input: {
        spread: 'three_ppf',
        allowReversed: false,
        pickedIndices: [77, 9, 30],
        category: 'career',
        question: { text: 'private question' },
      },
    },
    {
      system: 'iching',
      input: {
        question: {
          method: 'liuyao',
          category: 'study',
          liuyao: { throws: [3, 1, 2, 2, 1, 0] },
          question: 'private question',
        },
      },
    },
    ...(['time', 'numbers', 'random'] as const).map((castBy) => ({
      system: 'iching' as const,
      input: {
        question: {
          method: 'meihua',
          category: 'decision',
          meihua: { castBy, at: now, ...(castBy === 'numbers' ? { numbers: [3, 5, 1] } : {}) },
        },
      },
    })),
    {
      system: 'qimen',
      input: { question: { at: now, category: 'travel', question: 'private question' } },
    },
  ];
  for (const { system, input } of cases) {
    const id = mockRandomUUID();
    const preview = compute({ system, now, seed: 'M07', ...input }).chart;
    const first = await createNativeReading(system, null, undefined, now, 'M07', input, id);
    const retry = await createNativeReading(system, null, undefined, now, 'M07', input, id);
    expect(first.id).toBe(retry.id);
    expect(first.data?.chart).toEqual(preview);
    expect(JSON.stringify(first.data?.chart)).not.toContain('private question');
    expect(first.data?.inputSnapshot.question).toEqual(input.question);
    expect((await loadNativeReading(id, system, 'en'))?.chart.data).toEqual(preview);
    expect((await loadNativeReading(id, system, 'zh'))?.chart.data).toEqual(preview);
  }
  expect(await mockStore.readings.list()).toHaveLength(cases.length);
});
