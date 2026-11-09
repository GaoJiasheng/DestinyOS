import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  computeAstrology,
  computeBazi,
  computeDaily,
  dailyStars,
  DIMENSIONS,
  hashSeed,
  normalizeBirth,
} from '@tianji/engine';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

const birth = normalizeBirth(A),
  baziChart = computeBazi(birth, { now: '2026-10-04T04:00:00Z', yearsAround: 0 }),
  astroChart = computeAstrology(birth);
const start = Temporal.PlainDate.from('2026-10-04');
/** Dimension note keys for 30 consecutive days of the shared fixture profile. */
function notes() {
  return Array.from({ length: 30 }, (_, i) => {
    const local = start.add({ days: i }).toString();
    const chart = computeDaily({
      birth,
      baziChart,
      astroChart,
      vedicChart: null,
      date: { local, tz: 'Asia/Shanghai' },
      seed: hashSeed(`fixture-A|${local}`),
    });
    return DIMENSIONS.map((dim) => `daily.rating.${dim}.${dailyStars(chart.scores[dim])}`);
  });
}
describe('daily dimension notes', () => {
  const days = notes();
  for (const [name, messages] of [
    ['zh', zh],
    ['en', en],
  ] as const) {
    const table = messages as Record<string, string>;
    it(`${name}: the five notes of one day never repeat`, () => {
      for (const keys of days) {
        const texts = keys.map((key) => table[key]);
        expect(texts.every(Boolean)).toBe(true);
        expect(new Set(texts).size).toBe(5);
      }
    });
    it(`${name}: all 25 dimension × star notes are distinct`, () => {
      const all = DIMENSIONS.flatMap((dim) =>
        [1, 2, 3, 4, 5].map((n) => table[`daily.rating.${dim}.${n}`]),
      );
      expect(new Set(all).size).toBe(25);
    });
  }
  it('varies within a dimension across 30 days', () => {
    const distinct = DIMENSIONS.map((_, i) => new Set(days.map((keys) => keys[i])).size);
    expect(Math.min(...distinct)).toBeGreaterThanOrEqual(2);
  });
  it('is deterministic', () => {
    expect(notes()).toEqual(days);
  });
});
