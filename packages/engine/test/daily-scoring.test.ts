import { type DailyTransit } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { clampDailyScore, dailyBand, dailyStars, scoreDaily, type DailyScoreContext } from '../src';
import { base, daily, deltaFor, emptyRulesContext, transit } from './daily-fixtures';

describe('daily scoring rows and boundary behavior', () => {
  it.each([
    ['zheng_guan', 'strong', [12, 0, 0, 0, 4]],
    ['qi_sha', 'weak', [-9, 0, 0, -3, -3]],
    ['zheng_guan', 'balanced', [6, 0, 0, 0, 2]],
    ['zheng_cai', 'strong', [0, 13, 4, 0, 0]],
    ['pian_cai', 'weak', [0, -10, 4, 0, 0]],
    ['pian_cai', 'balanced', [0, 7, 4, 0, 0]],
    ['shi_shen', 'strong', [2, 2, 6, 4, 7]],
    ['shang_guan', 'weak', [-3, 5, 3, -5, -4]],
    ['zheng_yin', 'strong', [5, -5, 2, 9, 0]],
    ['pian_yin', 'weak', [2, -6, -3, 6, -5]],
    ['bi_jian', 'strong', [3, -2, -4, 3, 9]],
    ['jie_cai', 'weak', [1, -11, -6, -2, 4]],
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
  it('half-weights the branch main-hidden-stem ten god', () => {
    expect(
      deltaFor('branch_wealth', emptyRulesContext({ branchGod: 'zheng_cai', strength: 'strong' })),
    ).toEqual([0, 7, 2, 0, 0]);
    expect(scoreDaily(emptyRulesContext({ branchGod: 'zheng_guan' })).findings).toContain(
      'bazi.branchGod.zheng_guan',
    );
  });
  it.each([
    ['favorable', { favorableHit: true }, [4, 4, 4, 4, 10]],
    ['favorable', { favorableHit: true, god: 'zheng_guan' }, [10, 4, 4, 4, 4]],
    ['unfavorable', { unfavorableHit: true }, [-4, -4, -4, -4, -11]],
    ['unfavorable', { unfavorableHit: true, god: 'zheng_cai' }, [-4, -11, -4, -4, -4]],
    ['combine', { dayRelations: [{ pillar: 'day', type: 'combine' }] }, [0, 0, 12, 2, 4]],
    ['combine', { dayRelations: [{ pillar: 'day', type: 'tri_combine' }] }, [0, 0, 12, 2, 4]],
    ['clash', { dayRelations: [{ pillar: 'day', type: 'clash' }] }, [0, 0, -12, -5, -3]],
    [
      'punish_harm',
      {
        dayRelations: [
          { pillar: 'day', type: 'punish' },
          { pillar: 'day', type: 'harm' },
        ],
      },
      [0, 0, -7, -4, -2],
    ],
    ['month_combine', { dayRelations: [{ pillar: 'month', type: 'combine' }] }, [10, 3, 0, 0, 0]],
    ['month_clash', { dayRelations: [{ pillar: 'month', type: 'clash' }] }, [-10, -2, 0, 0, -2]],
    ['year_combine', { dayRelations: [{ pillar: 'year', type: 'tri_combine' }] }, [1, 0, 2, 0, 9]],
    ['year_clash', { dayRelations: [{ pillar: 'year', type: 'harm' }] }, [0, -3, 0, 0, -9]],
    ['hour_combine', { dayRelations: [{ pillar: 'hour', type: 'combine' }] }, [0, 5, 0, 7, 0]],
    ['hour_clash', { dayRelations: [{ pillar: 'hour', type: 'punish' }] }, [0, -5, 0, -7, 0]],
    [
      'luck_clash',
      { secondaryRelations: [{ target: 'luck', kind: 'stem', type: 'clash' }] },
      [-4, -3, 0, -3, 0],
    ],
    [
      'year_cycle_clash',
      { secondaryRelations: [{ target: 'year', kind: 'branch', type: 'clash' }] },
      [0, -3, -2, 0, -4],
    ],
    [
      'luck_combine',
      { secondaryRelations: [{ target: 'luck', kind: 'branch', type: 'combine' }] },
      [3, 3, 0, 0, 0],
    ],
    [
      'year_cycle_combine',
      { secondaryRelations: [{ target: 'year', kind: 'stem', type: 'combine' }] },
      [0, 0, 2, 0, 3],
    ],
  ] satisfies [string, Partial<DailyScoreContext>, number[]][])(
    'applies %s row once while preserving evidence',
    (rule, patch, expected) => expect(deltaFor(rule, emptyRulesContext(patch))).toEqual(expected),
  );
  it.each([
    ['moon_support', transit('moon', 'venus', 'trine'), [0, 0, 8, 2, 4]],
    ['moon_support', transit('moon', 'moon', 'conjunction'), [0, 0, 8, 2, 4]],
    ['moon_sun_support', transit('moon', 'sun', 'sextile'), [4, 0, 0, 4, 0]],
    ['moon_tension', transit('moon', 'sun', 'square'), [-2, 0, -4, -7, -2]],
    ['moon_tension', transit('moon', 'moon', 'opposition'), [-2, 0, -4, -7, -2]],
    ['venus_support', transit('venus', 'moon', 'trine'), [0, 5, 9, 0, 2]],
    ['venus_tension', transit('venus', 'sun', 'square'), [0, -4, -6, 0, 0]],
    ['mercury_support', transit('mercury', 'mercury', 'sextile'), [6, 0, 0, 0, 5]],
    ['mercury_tension', transit('mercury', 'moon', 'opposition'), [-3, 0, 0, 0, -5]],
    ['sun_support', transit('sun', 'mc', 'trine'), [6, 0, 0, 3, 0]],
    ['sun_tension', transit('sun', 'moon', 'square'), [-3, 0, 0, -3, 0]],
    ['mars_support', transit('mars', 'sun', 'trine'), [6, 0, 0, 5, 0]],
    ['mars_tension', transit('mars', 'mars', 'opposition'), [-3, 0, 0, -8, -5]],
    ['jupiter_support', transit('jupiter', 'asc', 'trine'), [5, 10, 0, 0, 2]],
    ['saturn_tension', transit('saturn', 'moon', 'square'), [-8, 0, -2, -4, 0]],
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
    ).toEqual([-3, 0, 0, 0, -4]);
    expect(
      deltaFor('mercury_retrograde', {
        ...base,
        astro: { ...base.astro, retrogrades: ['venus', 'mars'] },
      }),
    ).toEqual([0, 0, 0, 0, 0]);
    expect(
      deltaFor('venus_retrograde', { ...base, astro: { ...base.astro, retrogrades: ['venus'] } }),
    ).toEqual([0, -3, -4, 0, 0]);
    expect(
      deltaFor('mars_retrograde', { ...base, astro: { ...base.astro, retrogrades: ['mars'] } }),
    ).toEqual([-2, 0, 0, -3, 0]);
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
  it('has no scoring for a break, and suit scoring needs a suited card', () => {
    expect(
      scoreDaily({ ...base, dayRelations: [{ pillar: 'day', type: 'break' }] }).scores,
    ).toEqual(scoreDaily(base).scores);
    expect(
      deltaFor('tarot_suit', { ...base, tarot: { card: 'major_01_magician', reversed: false } }),
    ).toEqual([0, 0, 0, 0, 0]);
    expect(
      deltaFor('tarot_suit', { ...base, tarot: { card: 'cups_04', reversed: false } }),
    ).toEqual([0, 0, 4, 0, 0]);
    expect(
      deltaFor('tarot_suit', { ...base, tarot: { card: 'pentacles_04', reversed: true } }),
    ).toEqual([0, -3, 0, 0, 0]);
  });
  it('names one driver per dimension in the direction it moved, preferring distinct rules', () => {
    const { drivers, scores } = scoreDaily(
      emptyRulesContext({
        god: 'zheng_cai',
        strength: 'strong',
        favorableHit: true,
        dayRelations: [{ pillar: 'month', type: 'combine' }],
        natalBranches: { month: 'wu' },
      }),
    );
    expect(drivers.wealth).toMatchObject({ rule: 'wealth', category: 'wealth', direction: 'up' });
    expect(drivers.career).toMatchObject({
      rule: 'month_combine',
      category: 'harmony',
      hit: 'bazi.branch.month.combine',
      natalBranch: 'wu',
    });
    for (const dim of ['career', 'wealth', 'love', 'health', 'social'] as const) {
      const driver = drivers[dim];
      if (driver) expect(scores[dim] > 60).toBe(driver.direction === 'up');
    }
  });
  it('returns a null driver when a dimension has no reason worth stating', () => {
    expect(scoreDaily(emptyRulesContext({ god: 'bi_jian' }), []).drivers.career).toBeNull();
  });
  it('clamps every dimension after aggregation and uses the documented overall weights', () => {
    for (const delta of [-500, 500]) {
      const result = scoreDaily(base, [
        {
          id: 'boundary',
          theme: 'shi_shen',
          driver: 'element',
          matches: () => ['test.boundary'],
          delta: { career: delta, wealth: delta, love: delta, health: delta, social: delta },
        },
      ]);
      expect(Object.values(result.scores)).toEqual(Array(6).fill(delta > 0 ? 95 : 15));
    }
    expect(clampDailyScore(50)).toBe(50);
    expect(clampDailyScore(-1)).toBe(15);
    expect(clampDailyScore(100)).toBe(95);
    const { career, wealth, love, health, social, overall } = daily.scores;
    const blended = career * 0.25 + wealth * 0.2 + love * 0.2 + health * 0.2 + social * 0.15;
    expect(overall).toBeCloseTo(clampDailyScore(60 + (blended - 60) * 1.5), 1);
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
