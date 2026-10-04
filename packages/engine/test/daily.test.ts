import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import {
  DailyChartSchema,
  type AstroChart,
  type DailyTransit,
  type Element,
  type TenGod,
} from '@tianji/shared';
import {
  computeDaily,
  compute,
  computeBazi,
  computeAstrology,
  computeVedic,
  normalizeBirth,
  hashSeed,
  dailyDateAt,
  scoreDaily,
  DAILY_SCORE_RULES,
  dailyStars,
  dailyBand,
  clampDailyScore,
  findDailyTransits,
  dailyAstro,
  COLOR_FAMILIES,
  luckyColor,
  goodHours,
  nobleZodiac,
  mapAlmanac,
  ALMANAC_MAPPING,
  selectDailyActions,
  BRANCHES,
  STEMS,
  branchRelations,
  fiveRat,
  STEM_ELEMENTS,
  type DailyInput,
  type DailyScoreContext,
  type Position,
} from '../src';
import A from './fixtures/birth/A.json';
import E from './fixtures/birth/E.json';
import golden from './fixtures/daily/A.json';
import zh from '../../../apps/web/messages/zh.json';
import en from '../../../apps/web/messages/en.json';
const birth = normalizeBirth(A),
  now = '2026-10-04T04:00:00Z';
const natal = computeBazi(birth, { now, yearsAround: 0 }),
  astro = computeAstrology(birth);
const input: DailyInput = {
  birth,
  baziChart: natal,
  astroChart: astro,
  vedicChart: null,
  date: { local: '2026-10-04', tz: 'Asia/Shanghai' },
  seed: hashSeed('fixture-A|2026-10-04'),
};
const daily = computeDaily(input);
const base: DailyScoreContext = {
  god: 'bi_jian',
  strength: 'balanced',
  favorableHit: false,
  unfavorableHit: false,
  dayRelations: [],
  secondaryRelations: [],
  astro: { ...daily.astro, transits: [], retrogrades: [] },
  tarot: { card: 'major_00_fool', reversed: false },
};
const emptyRulesContext = (patch: Partial<DailyScoreContext> = {}) => ({ ...base, ...patch });
const transit = (
  transiting: DailyTransit['transiting'],
  natal: DailyTransit['natal'],
  aspect: DailyTransit['aspect'],
): DailyTransit => ({ transiting, natal, aspect, orb: 0.1, applying: false });
const deltaFor = (rule: string, context: DailyScoreContext) => {
  const row = DAILY_SCORE_RULES.find((r) => r.id === rule)!;
  const result = scoreDaily(context, [row]);
  return [
    result.scores.career,
    result.scores.wealth,
    result.scores.love,
    result.scores.health,
    result.scores.social,
  ].map((score) => score - 60);
};
describe('daily §8 Fixture A and deterministic output', () => {
  it('freezes stem/branch, ten-god, relations, all scores, shade family, good hours and daily card', () => {
    expect(daily).toEqual(golden);
    expect(DailyChartSchema.parse(daily)).toEqual(daily);
    // Independent mature-calendar read, no engine calendar helpers.
    const lunar = Solar.fromYmdHms(2026, 10, 4, 12, 0, 0).getLunar();
    expect([
      lunar.getYearInGanZhiExact(),
      lunar.getMonthInGanZhiExact(),
      lunar.getDayInGanZhiExact(),
    ]).toEqual(['丙午', '丁酉', '辛亥']);
    // Manual §3.5: peer [2,-8,-4,0,6] + unfavorable [-8,-8,-6,-8,-6], starting from 60.
    expect(daily.scores).toEqual({
      career: 54,
      wealth: 44,
      love: 50,
      health: 52,
      social: 60,
      overall: 51.7,
    });
    expect(daily.bazi.branchRelations).toContainEqual({ pillar: 'month', type: 'clash' });
    expect(daily.bazi.luckyColorElement).toBe('wood');
    expect(daily.bazi.nobleZodiac).toEqual(['yin', 'mao', 'wei']);
  });
  it('does not mutate reusable cached natal inputs or options', () => {
    const original = JSON.stringify(input);
    expect(computeDaily(input)).toEqual(daily);
    expect(JSON.stringify(input)).toBe(original);
    const alternate = computeDaily({ ...input, seed: hashSeed('different-user|2026-10-04') });
    expect(alternate.date).toEqual(daily.date);
    expect(alternate.bazi.goodHours).toEqual(daily.bazi.goodHours);
    expect(alternate.tarot).not.toEqual(daily.tarot);
  });
  it('supports uniform daily dispatch and an explicit zoned target date', () => {
    expect(compute({ system: 'daily', birth, now, seed: input.seed }).chart).toEqual(daily);
    const zoned = Temporal.Instant.from('2026-10-04T03:00Z').toZonedDateTimeISO('America/New_York');
    expect(
      compute({ system: 'daily', birth, now: zoned, seed: input.seed }).chart.date,
    ).toMatchObject({ local: '2026-10-03', tz: 'America/New_York' });
    expect(() => compute({ system: 'daily', birth, now })).toThrow('E_INVALID_INPUT');
    expect(() =>
      compute({
        system: 'daily',
        birth,
        now,
        seed: 'x',
        options: { school: { unsupported: true } },
      }),
    ).toThrow('E_UNSUPPORTED_SCHOOL');
  });
  it('changes localDate and flow day for one UTC instant in New York and Tokyo', () => {
    const ny = dailyDateAt('2026-10-04T03:00Z', 'America/New_York'),
      tokyo = dailyDateAt('2026-10-04T03:00Z', 'Asia/Tokyo');
    expect(ny.local).toBe('2026-10-03');
    expect(tokyo.local).toBe('2026-10-04');
    expect(computeDaily({ ...input, date: ny }).date.ganZhi.day).toEqual({
      stem: 'geng',
      branch: 'xu',
    });
    expect(computeDaily({ ...input, date: tokyo }).date.ganZhi.day).toEqual({
      stem: 'xin',
      branch: 'hai',
    });
    expect(() => dailyDateAt('bad-instant', 'UTC')).toThrow('E_INVALID_INPUT');
    expect(() => dailyDateAt(now, 'not/a/zone')).toThrow('E_INVALID_INPUT');
  });
  it('uses absolute solar-term boundaries across zones and exposes terms within 3 days', () => {
    const before = computeDaily({ ...input, date: { local: '2026-10-07', tz: 'Asia/Tokyo' } });
    const after = computeDaily({ ...input, date: { local: '2026-10-09', tz: 'Asia/Tokyo' } });
    expect(before.date.ganZhi.month.branch).toBe('you');
    expect(after.date.ganZhi.month.branch).toBe('xu');
    expect(before.date.solarTerm?.name).toBe('han_lu');
  });
  it('supports unknown time, optional current location and cached Vedic chart without invented angles', () => {
    const unknown = normalizeBirth(E);
    const baziChart = computeBazi(unknown, { now, yearsAround: 0 });
    const chart = computeDaily(
      {
        ...input,
        birth: unknown,
        baziChart,
        astroChart: computeAstrology(unknown),
        vedicChart: computeVedic(unknown, now),
      },
      { place: { lat: 28.6139, lng: 77.209 } },
    );
    expect(chart.astro.transits.every((t) => ['sun', 'moon'].includes(t.natal))).toBe(true);
    expect(chart.bazi.branchRelations.every((r) => r.pillar !== 'hour')).toBe(true);
    expect(chart.vedic?.sunrise).not.toBe(daily.vedic?.sunrise);
    expect(chart.vedic?.vara.key).toBe('raviwara');
    expect(computeDaily({ ...input, astroChart: null }).astro.transits).toEqual([]);
  });
  it('uses coordinate and favorable-element fallbacks and historical/future cached luck periods', () => {
    const fallbackBirth = normalizeBirth({ ...A, place: undefined });
    const fallback = computeDaily({
      ...input,
      birth: fallbackBirth,
      baziChart: { ...natal, useGod: { ...natal.useGod, favorable: [] } },
      date: { local: '2026-10-04', tz: 'Pacific/Kiritimati' },
    });
    expect(fallback.bazi.luckyColorElement).toBe(natal.dayMaster.element);
    expect(fallback.vedic?.sunrise).toBeTruthy();
    for (const date of ['1990-05-16', '2000-01-01', '2035-01-01', '2100-01-01']) {
      const chart = computeDaily({ ...input, date: { ...input.date, local: date } });
      expect(chart.bazi.secondaryRelations).toEqual(expect.any(Array));
      if (date === '1990-05-16' || date === '2100-01-01')
        expect(chart.bazi.secondaryRelations.every((r) => r.target !== 'luck')).toBe(true);
    }
  });
  it.each(['2026-02-30', '04-10-2026', '1899-10-04', '2101-10-04'])(
    'rejects invalid/out-of-range %s',
    (local) => {
      expect(() => computeDaily({ ...input, date: { ...input.date, local } })).toThrow(
        local.startsWith('1899') || local.startsWith('2101')
          ? 'E_DATE_OUT_OF_RANGE'
          : 'E_INVALID_INPUT',
      );
    },
  );
  it('rejects missing seed, invalid zone, skipped civil day and invalid location/action candidates', () => {
    expect(() => computeDaily({ ...input, seed: '' })).toThrow('E_INVALID_INPUT');
    expect(() => computeDaily({ ...input, date: { ...input.date, tz: 'invalid' } })).toThrow(
      'E_INVALID_INPUT',
    );
    expect(() =>
      computeDaily({ ...input, date: { local: '2011-12-30', tz: 'Pacific/Apia' } }),
    ).toThrow('E_INVALID_INPUT');
    expect(() => computeDaily(input, { place: { lat: 91, lng: 0 } })).toThrow('E_INVALID_INPUT');
    expect(() =>
      computeDaily(input, {
        actionUnits: [{ id: 'x', findings: [], weight: 1, do: ['natural language'], dont: [] }],
      }),
    ).toThrow('E_INVALID_INPUT');
  });
});
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
describe('lucky indicators, strict almanac whitelist and action keys', () => {
  it('covers every family, correct numbers/direction, and seed-stable shade selection', () => {
    for (const element of Object.keys(COLOR_FAMILIES) as Element[])
      for (let i = 0; i < 12; i++) {
        const color = luckyColor(element, `color-seed-${i}`);
        expect(
          COLOR_FAMILIES[element].some(
            ([name, hex]) => color.name === `daily.color.${name}` && color.hex === hex,
          ),
        ).toBe(true);
        expect(luckyColor(element, `color-seed-${i}`)).toEqual(color);
      }
  });
  it('selects two favorable, non-clashing hours and falls back with wrapped Zi endpoints', () => {
    for (const stem of STEMS)
      for (const branch of BRANCHES) {
        const hours = goodHours(stem, branch, ['wood', 'fire']);
        expect(hours).toHaveLength(2);
        expect(new Set(hours.map((h) => h.branch)).size).toBe(2);
        expect(hours.every((h) => !branchRelations(h.branch, branch).includes('clash'))).toBe(true);
        expect(
          hours.every((h) => ['wood', 'fire'].includes(STEM_ELEMENTS[fiveRat(stem, h.branch)])),
        ).toBe(true);
      }
    expect(goodHours('jia', 'zi', [])).toEqual([
      { branch: 'zi', from: '23:00', to: '01:00' },
      { branch: 'chou', from: '01:00', to: '03:00' },
    ]);
    expect(nobleZodiac('zi')).toEqual(['chou', 'chen', 'shen']);
  });
  it('whitelists/maps/deduplicates §6 and never emits unknown or forbidden tokens', () => {
    const blocked = [
      '安葬',
      '破土',
      '启钻',
      '除服',
      '成服',
      '伐木',
      '作梁',
      '上梁',
      '掘井',
      '纳畜',
      '开仓',
      '谢土',
      '未知',
    ];
    expect(mapAlmanac(blocked)).toEqual([]);
    expect(mapAlmanac(['开市', '交易', '立券', '纳财', '出行', '安葬'])).toEqual([
      'daily.almanac.deals',
      'daily.almanac.travel',
    ]);
    expect(mapAlmanac(Object.keys(ALMANAC_MAPPING))).toHaveLength(12);
    expect(
      [...daily.bazi.almanac.yi, ...daily.bazi.almanac.ji].every((key) =>
        key.startsWith('daily.almanac.'),
      ),
    ).toBe(true);
  });
  it('selects matching KU actions by weight, seed-shuffles ties, blocks aliases and all conflicts', () => {
    const findings = daily.findings;
    const units = [
      {
        id: 'matched',
        findings: [findings[0]!],
        weight: 20,
        do: [
          'daily.actions.review',
          'daily.actions.review',
          'daily.actions.listen',
          'daily.almanac.travel',
          'daily.actions.romance',
        ],
        dont: ['daily.actions.listen', 'daily.actions.rush'],
      },
      {
        id: 'low',
        findings: [findings[0]!],
        weight: 2,
        do: ['daily.actions.ask'],
        dont: ['daily.actions.overpromise'],
      },
      {
        id: 'irrelevant',
        findings: ['not.matched'],
        weight: 100,
        do: ['test.ignored'],
        dont: ['test.ignored'],
      },
    ];
    const result = selectDailyActions(input.seed, findings, daily.bazi.almanac, units);
    expect(result.do).toContain('daily.actions.review');
    expect(result.do).toContain('daily.actions.ask');
    const all = [...result.do, ...result.dont];
    expect(new Set(all).size).toBe(6);
    expect(all).not.toContain('daily.almanac.travel');
    expect(all).not.toContain('daily.actions.romance');
    expect(all).not.toContain('test.ignored');
    expect(selectDailyActions(input.seed, findings, daily.bazi.almanac, units)).toEqual(result);
    expect(computeDaily(input, { actionUnits: units }).doDont).toEqual(result);
    expect(selectDailyActions('one', [], daily.bazi.almanac)).not.toEqual(
      selectDailyActions('two', [], daily.bazi.almanac),
    );
  });
  it('provides bilingual next-intl copy for every emitted indicator/action/oneliner key', () => {
    const catalogs: Record<string, string>[] = [zh, en];
    const keys = [
      ...daily.bazi.luckyColor,
      daily.bazi.luckyDirection,
      ...daily.bazi.almanac.yi,
      ...daily.bazi.almanac.ji,
      ...daily.doDont.do,
      ...daily.doDont.dont,
      daily.oneLiner,
    ];
    for (const c of catalogs) for (const key of keys) expect(c[key]).toBeTruthy();
    for (const god of [
      'bi_jian',
      'jie_cai',
      'shi_shen',
      'shang_guan',
      'zheng_cai',
      'pian_cai',
      'zheng_guan',
      'qi_sha',
      'zheng_yin',
      'pian_yin',
    ] as TenGod[])
      for (const band of ['great', 'good', 'mixed', 'careful']) {
        const key = `daily.oneliner.${band}.${god}`;
        expect(zh[key as keyof typeof zh].length).toBeLessThanOrEqual(40);
        expect(en[key as keyof typeof en].split(/\s+/).length).toBeLessThanOrEqual(25);
      }
    const almanac = [...daily.bazi.almanac.yi, ...daily.bazi.almanac.ji];
    for (const list of [daily.doDont.do, daily.doDont.dont]) {
      expect(list).toHaveLength(3);
      expect(new Set(list).size).toBe(3);
      expect(list.some((key) => almanac.includes(key))).toBe(false);
      for (const key of list) {
        expect(catalogs[0]![key]!.length).toBeLessThanOrEqual(6);
        expect(catalogs[1]![key]!.split(/\s+/).length).toBeLessThanOrEqual(3);
      }
    }
  });
});
const position = (lon: number, speed = 1): Position => ({
  lon,
  lat: 0,
  speed,
  retrograde: speed < 0,
});
describe('daily western-specific transit limits, ingress, lunations and retrogrades', () => {
  const target = (lon: number, noonChart = false): AstroChart => ({
    ...astro,
    noonChart,
    bodies: [{ ...astro.bodies[0]!, key: 'sun', lon }],
    angles: null,
  });
  const positions = (body: string, lon: number, speed = 1) =>
    Object.fromEntries(
      ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((key) => [
        key,
        position(key === body ? lon : 17.3, speed),
      ]),
    ) as Record<'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn', Position>;
  it.each([
    ['moon', 3, true],
    ['moon', 3.001, false],
    ['sun', 1.5, true],
    ['sun', 1.501, false],
    ['jupiter', 1, true],
    ['jupiter', 1.001, false],
    ['saturn', 1, true],
  ] as const)('uses %s orb %s inclusive=%s', (body, orb, expected) =>
    expect(
      findDailyTransits(positions(body, orb), target(0)).some((hit) => hit.transiting === body),
    ).toBe(expected),
  );
  it('handles all major aspects, applying/separating and wraparound without luminary bonus', () => {
    for (const angle of [0, 60, 90, 120, 180]) {
      const hits = findDailyTransits(positions('sun', angle + 0.5, -1), target(0));
      expect(hits[0]?.orb).toBeCloseTo(0.5);
      expect(hits[0]?.applying).toBe(true);
    }
    expect(findDailyTransits(positions('sun', 359.5, 1), target(0))[0]?.applying).toBe(true);
    expect(findDailyTransits(positions('sun', 0.5, 1), target(0))[0]?.applying).toBe(false);
    expect(findDailyTransits(positions('sun', 0, 0), target(0))[0]?.applying).toBe(false);
    expect(findDailyTransits(positions('sun', 0), null)).toEqual([]);
  });
  it('sorts/caps three tightest aspects, excludes slow→MC/Venus, and omits unknown-time targets', () => {
    const custom: AstroChart = {
      ...astro,
      bodies: [{ ...astro.bodies[0]!, key: 'venus', lon: 0 }],
      angles: { asc: 1.8, mc: 0, dsc: 181.8, ic: 180 },
    };
    const p = positions('sun', 0);
    p.moon = position(0.2);
    p.mercury = position(0.3);
    p.jupiter = position(0);
    p.saturn = position(0);
    const hits = findDailyTransits(p, custom);
    expect(hits).toHaveLength(3);
    expect(hits.map((t) => t.orb)).toEqual([0, 0, 0.19999999999998863]);
    expect(hits.every((t) => !['jupiter', 'saturn'].includes(t.transiting))).toBe(true);
    expect(findDailyTransits(p, { ...custom, noonChart: true })).toEqual([]);
    expect(findDailyTransits(p, custom, true)).toEqual([]);
  });
  it('detects ingress within the local civil day and real new/full-moon events rather than a phase bin', () => {
    const ingress = dailyAstro('2026-10-05', 'Asia/Shanghai', null, false);
    expect(ingress.moonChangesSign).toBe(true);
    expect(ingress.moonIngress?.sign).toBe('leo');
    expect(
      Temporal.Instant.from(ingress.moonIngress!.at).toZonedDateTimeISO('Asia/Shanghai').day,
    ).toBe(5);
    const newMoon = dailyAstro('2026-10-10', 'Asia/Shanghai', null, false);
    expect(newMoon.lunation).toBe('new_moon');
    expect(dailyAstro('2026-10-26', 'Asia/Shanghai', null, false).lunation).toBe('full_moon');
    expect(dailyAstro('2026-10-11', 'Asia/Shanghai', null, false).lunation).toBeNull();
    expect(dailyAstro('2026-11-01', 'America/New_York', null, false).retrogrades).toContain(
      'mercury',
    );
  });
});
