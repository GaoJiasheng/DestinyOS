import { type DailyTransit } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { clampDailyScore, dailyBand, dailyStars, scoreDaily, type DailyScoreContext } from '../src';
import { base, daily, deltaFor, emptyRulesContext, transit } from './daily-fixtures';

describe('all §3.5 scoring rows and boundary behavior', () => {
  it.each([
    ['zheng_guan', 'strong', [10, 0, 0, 0, 4]],
    ['qi_sha', 'weak', [-10, 0, 0, 0, -4]],
    ['zheng_guan', 'balanced', [0, 0, 0, 0, 0]],
    ['zheng_cai', 'strong', [0, 12, 4, 0, 0]],
    ['pian_cai', 'weak', [0, -12, 4, 0, 0]],
    ['pian_cai', 'balanced', [0, 0, 4, 0, 0]],
    ['shi_shen', 'strong', [4, 3, 5, 0, 3]],
    ['shang_guan', 'weak', [4, 3, 5, -3, 3]],
    ['zheng_yin', 'strong', [3, -4, 0, 5, 0]],
    ['pian_yin', 'weak', [3, -4, 0, 5, 0]],
    ['bi_jian', 'strong', [2, 0, -4, 0, 6]],
    ['jie_cai', 'weak', [2, -8, -4, 0, 6]],
  ] as const)('applies %s/%s exactly', (god, strength, expected) => {
    const result = scoreDaily(emptyRulesContext({ god, strength }));
    expect(
      [
        result.scores.career,
        result.scores.wealth,
        result.scores.love,
        result.scores.health,
        result.scores.social,
      ].map((s) => s - 60),
    ).toEqual(expected);
    expect(result.findings).toEqual([`bazi.tenGod.${god}.${strength}`]);
  });
  it.each([
    ['favorable', { favorableHit: true }, [8, 8, 6, 8, 6]],
    ['unfavorable', { unfavorableHit: true }, [-8, -8, -6, -8, -6]],
    ['combine', { dayRelations: [{ pillar: 'day', type: 'combine' }] }, [5, 4, 10, 4, 8]],
    ['combine', { dayRelations: [{ pillar: 'day', type: 'tri_combine' }] }, [5, 4, 10, 4, 8]],
    ['clash', { dayRelations: [{ pillar: 'day', type: 'clash' }] }, [-6, -5, -10, -6, -8]],
    [
      'punish_harm',
      {
        dayRelations: [
          { pillar: 'day', type: 'punish' },
          { pillar: 'day', type: 'harm' },
        ],
      },
      [-4, -3, -6, -5, -6],
    ],
    [
      'secondary_clash',
      {
        secondaryRelations: [
          { target: 'luck', kind: 'stem', type: 'clash' },
          { target: 'year', kind: 'branch', type: 'clash' },
        ],
      },
      [-4, -4, -3, -3, -3],
    ],
  ] satisfies [string, Partial<DailyScoreContext>, number[]][])(
    'applies %s row once while preserving evidence',
    (rule, patch, expected) => expect(deltaFor(rule, emptyRulesContext(patch))).toEqual(expected),
  );
  it.each([
    ['moon_support', transit('moon', 'venus', 'trine'), [0, 0, 8, 3, 5]],
    ['moon_support', transit('moon', 'moon', 'conjunction'), [0, 0, 8, 3, 5]],
    ['moon_support', transit('moon', 'venus', 'sextile'), [0, 0, 8, 3, 5]],
    ['moon_tension', transit('moon', 'sun', 'square'), [-3, 0, -6, -5, -4]],
    ['moon_tension', transit('moon', 'moon', 'opposition'), [-3, 0, -6, -5, -4]],
    ['mars_tension', transit('mars', 'mars', 'opposition'), [-5, -3, -5, -6, -5]],
    ['jupiter_support', transit('jupiter', 'asc', 'trine'), [6, 8, 4, 4, 4]],
    ['saturn_tension', transit('saturn', 'moon', 'square'), [-6, -4, -3, -4, -3]],
  ] satisfies [string, DailyTransit, number[]][])('applies %s %j', (rule, t, expected) =>
    expect(deltaFor(rule, emptyRulesContext({ astro: { ...base.astro, transits: [t] } }))).toEqual(
      expected,
    ),
  );
  it('applies Mercury retrograde only and respects both Tarot orientation rules', () => {
    expect(
      deltaFor('mercury_retrograde', {
        ...base,
        astro: { ...base.astro, retrogrades: ['mercury'] },
      }),
    ).toEqual([-3, -2, 0, 0, -3]);
    expect(
      deltaFor('mercury_retrograde', {
        ...base,
        astro: { ...base.astro, retrogrades: ['venus', 'mars'] },
      }),
    ).toEqual([0, 0, 0, 0, 0]);
    for (const card of [
      'major_19_sun',
      'major_17_star',
      'major_21_world',
      'cups_10',
      'cups_09',
      'wands_06',
      'pentacles_10',
      'major_06_lovers',
      'major_03_empress',
    ] as const) {
      expect(deltaFor('tarot_auspicious', { ...base, tarot: { card, reversed: false } })).toEqual([
        2, 2, 2, 2, 2,
      ]);
      expect(deltaFor('tarot_auspicious', { ...base, tarot: { card, reversed: true } })).toEqual([
        0, 0, 0, 0, 0,
      ]);
    }
    for (const card of [
      'major_16_tower',
      'major_15_devil',
      'swords_10',
      'swords_03',
      'swords_09',
    ] as const)
      for (const reversed of [true, false])
        expect(deltaFor('tarot_caution', { ...base, tarot: { card, reversed } })).toEqual([
          -2, -2, -2, -2, -2,
        ]);
    expect(
      deltaFor('tarot_caution', { ...base, tarot: { card: 'major_18_moon', reversed: true } }),
    ).toEqual([-2, -2, -2, -2, -2]);
    expect(
      deltaFor('tarot_caution', { ...base, tarot: { card: 'major_18_moon', reversed: false } }),
    ).toEqual([0, 0, 0, 0, 0]);
  });
  it('has no scoring for a break, non-day relationships or secondary combinations', () => {
    expect(
      scoreDaily({
        ...base,
        dayRelations: [
          { pillar: 'day', type: 'break' },
          { pillar: 'year', type: 'combine' },
        ],
        secondaryRelations: [{ target: 'luck', kind: 'branch', type: 'combine' }],
      }).scores,
    ).toEqual(scoreDaily(base).scores);
  });
  it('clamps every dimension after aggregation and uses the documented overall weights', () => {
    for (const delta of [-500, 500]) {
      const result = scoreDaily(base, [
        {
          id: 'boundary',
          theme: 'shi_shen',
          matches: () => ['test.boundary'],
          delta: { career: delta, wealth: delta, love: delta, health: delta, social: delta },
        },
      ]);
      expect(Object.values(result.scores)).toEqual(Array(6).fill(delta > 0 ? 95 : 15));
    }
    expect(clampDailyScore(50)).toBe(50);
    expect(clampDailyScore(-1)).toBe(15);
    expect(clampDailyScore(100)).toBe(95);
    expect(daily.scores.overall).toBeCloseTo(
      54 * 0.25 + 44 * 0.2 + 50 * 0.2 + 52 * 0.2 + 60 * 0.15,
    );
  });
  it.each([
    [15, 1],
    [39.99, 1],
    [40, 2],
    [54.99, 2],
    [55, 3],
    [69.99, 3],
    [70, 4],
    [84.99, 4],
    [85, 5],
    [95, 5],
  ] as const)('maps %s to %s stars', (score, stars) => expect(dailyStars(score)).toBe(stars));
  it.each([
    [15, 'careful'],
    [55, 'mixed'],
    [70, 'good'],
    [85, 'great'],
  ] as const)('maps %s to %s oneLiner band', (score, band) => expect(dailyBand(score)).toBe(band));
});
