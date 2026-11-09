import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  computeAstrology,
  computeBazi,
  computeDaily,
  computeDailyRange,
  DAILY_SCORE_RULES,
  dailyStars,
  DIMENSIONS,
  hashSeed,
  normalizeBirth,
  type DailyScoreContext,
  type Dimension,
} from '@tianji/engine';
import { dailyDimensionCopy } from '@tianji/ui-core/daily-drivers';
import type { BirthInput, DailyChart, Locale } from '@tianji/shared';
import { createTranslator } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../packages/engine/test/fixtures/birth/B.json';
import C from '../../../packages/engine/test/fixtures/birth/C.json';
import D from '../../../packages/engine/test/fixtures/birth/D.json';
import E from '../../../packages/engine/test/fixtures/birth/E.json';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import zhTW from '../messages/zh-TW.json';
import tarotZh from '../messages/zh/tarot.json';
import tarotEn from '../messages/en/tarot.json';

const profiles = [A, B, C, D, E] as unknown as BirthInput[];
const start = Temporal.PlainDate.from('2026-10-04');
const tz = 'Asia/Shanghai';
const dates = Array.from({ length: 30 }, (_, i) => start.add({ days: i }).toString());
const ranges = () =>
  profiles.map((profile, i) =>
    computeDailyRange(profile, dates[0]!, dates[29]!, tz, `diversity-${i}`),
  );
const days = ranges();
const translator = (messages: Record<string, string>, locale: Locale) => {
  const t = createTranslator({ locale, messages: toMessages(messages) });
  return (key: string, values?: Record<string, string>) => t(key, values);
};
const fakeChart = (day: (typeof days)[number][number]) =>
  ({
    scoreDrivers: day.drivers,
    date: { ganZhi: { day: { stem: 'jia', branch: 'zi' } } },
    bazi: { todayElement: 'wood' },
    tarot: { card: 'cups_04', reversed: false },
  }) as unknown as DailyChart;

describe('daily differentiation across 5 profiles × 30 days', () => {
  const stars = days.flat().map((day) => DIMENSIONS.map((dim) => dailyStars(day.scores[dim])));
  it('keeps most same-day dimension pairs on different star levels', () => {
    const pairs = stars.flatMap((row) =>
      row.flatMap((a, i) => row.slice(i + 1).map((b) => [a, b] as const)),
    );
    const different = pairs.filter(([a, b]) => a !== b).length / pairs.length;
    expect(different).toBeGreaterThan(0.55);
  });
  it('covers the whole star range with extremes staying rare', () => {
    const counts = [1, 2, 3, 4, 5].map((n) => stars.flat().filter((s) => s === n).length);
    expect(counts.every((n) => n > 0)).toBe(true);
    const total = counts.reduce((a, b) => a + b, 0);
    expect((counts[0]! + counts[4]!) / total).toBeLessThan(0.15);
    // Each profile still reaches at least four star levels within a month.
    for (const profile of days) {
      const levels = new Set(
        profile.flatMap((d) => DIMENSIONS.map((k) => dailyStars(d.scores[k]))),
      );
      expect(levels.size).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(days.flat().map((d) => dailyStars(d.overall))).size).toBeGreaterThanOrEqual(4);
  });
  it('gives each dimension many distinct notes over 30 days', () => {
    const copy = translator({ ...zh, ...tarotZh }, 'zh');
    for (const profile of days) {
      for (const dim of DIMENSIONS) {
        const notes = new Set(
          profile.map((day) => dailyDimensionCopy(fakeChart(day), dim, 'zh', copy)!.note),
        );
        expect(notes.size).toBeGreaterThanOrEqual(4);
      }
    }
  });
  it('is deterministic for every profile and date', () => {
    expect(ranges()).toEqual(days);
  });
  it.each([
    ['zh', { ...zh, ...tarotZh }],
    ['en', { ...en, ...tarotEn }],
  ] as const)('%s: the four paragraphs never coincide', (locale, messages) => {
    const copy = translator(messages, locale);
    profiles.forEach((raw, index) => {
      const birth = normalizeBirth(raw);
      const baziChart = computeBazi(birth, { now: '2026-10-04T04:00:00Z', yearsAround: 0 });
      const astroChart = computeAstrology(birth);
      for (const local of dates.filter((_, i) => i % 6 === 0)) {
        const chart = computeDaily({
          birth,
          baziChart,
          astroChart,
          vedicChart: null,
          date: { local, tz },
          seed: hashSeed(`diversity-${index}|${local}`),
        });
        const paragraphs = (['career', 'wealth', 'love', 'health'] as const).map(
          (dim) => dailyDimensionCopy(chart, dim, locale, copy)!.paragraph,
        );
        expect(new Set(paragraphs).size).toBe(4);
        expect(paragraphs.every((text) => !/不等于|并不替代|不能单独/.test(text))).toBe(true);
      }
    });
  });
});

describe('daily driver copy catalog', () => {
  const dims = DIMENSIONS as readonly Dimension[];
  const contexts = (): DailyScoreContext[] => {
    const gods = [
      'bi_jian',
      'jie_cai',
      'shi_shen',
      'shang_guan',
      'pian_cai',
      'zheng_cai',
      'qi_sha',
      'zheng_guan',
      'pian_yin',
      'zheng_yin',
    ] as const;
    const out: DailyScoreContext[] = [];
    for (const god of gods)
      for (const strength of ['strong', 'balanced', 'weak'] as const)
        for (const reversed of [false, true])
          for (const card of ['cups_04', 'wands_04', 'swords_04', 'pentacles_04'] as const)
            out.push({
              god,
              branchGod: god,
              strength,
              favorableHit: true,
              unfavorableHit: true,
              dayRelations: [],
              secondaryRelations: [],
              astro: { transits: [], retrogrades: [] },
              tarot: { card, reversed },
            });
    return out;
  };
  const reachable = () => {
    const keys = new Set<string>();
    for (const context of contexts())
      for (const rule of DAILY_SCORE_RULES) {
        if (typeof rule.delta === 'function' && !rule.matches(context).length) continue;
        const delta = typeof rule.delta === 'function' ? rule.delta(context) : rule.delta;
        for (const dim of dims) {
          const value = delta[dim] ?? 0;
          if (Math.abs(value) >= 3) keys.add(`${rule.driver}.${dim}.${value > 0 ? 'up' : 'down'}`);
        }
      }
    return [...keys];
  };
  it.each([
    ['zh', zh],
    ['en', en],
    ['zh-TW', zhTW],
  ] as const)('%s: every reachable driver has a unique note and effect', (_, messages) => {
    const table = messages as Record<string, string>;
    const slots = reachable();
    expect(slots.length).toBeGreaterThan(60);
    for (const slot of slots) {
      expect(table[`dailyDriver.note.${slot}`], slot).toBeTruthy();
      expect(table[`dailyDriver.effect.${slot}`], slot).toBeTruthy();
    }
    expect(new Set(slots.map((slot) => table[`dailyDriver.note.${slot}`])).size).toBe(slots.length);
    expect(new Set(slots.map((slot) => table[`dailyDriver.effect.${slot}`])).size).toBe(
      slots.length,
    );
    expect(table['daily.rating.career.1']).toBeTruthy();
  });
});
