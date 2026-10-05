import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import {
  BaziChartSchema,
  type BaziChart,
  type Stem,
  type Branch,
  type NormalizedBirth,
} from '@tianji/shared';
import {
  computeBazi,
  normalizeBirth,
  compute,
  EngineError,
  BAZI_SECT,
  baziWarnings,
  ganZhiAt,
  STEMS,
  BRANCHES,
  fiveTiger,
  fiveRat,
  STEM_YIN_YANG,
} from '../src';
import { makePillar } from '../src/bazi/pillars';
import {
  assessStrength,
  elementDistribution,
  selectUseGod,
  detectPattern,
} from '../src/bazi/analysis';
import { computeShenSha, DAY_STEM_SHA, oppositeBranch, KUI_GANG } from '../src/bazi/shen-sha';
import { computeFeatures } from '../src/bazi/features';
import { natalRelations } from '../src/bazi/relations';
import { startAgeFromMinutes, birthClock, termTime, toSolar } from '../src/bazi/calendar';
import A from './fixtures/bazi/A.json';
import B from './fixtures/bazi/B.json';
import BS from './fixtures/bazi/B-split.json';
import BC from './fixtures/bazi/B-clock.json';
import BCS from './fixtures/bazi/B-clock-split.json';
import C from './fixtures/bazi/C.json';
import D from './fixtures/bazi/D.json';
import E from './fixtures/bazi/E.json';
import G from './fixtures/bazi/G.json';
import GS from './fixtures/bazi/G-split.json';
import edges from './fixtures/bazi/edges.json';
import zh from '../../../apps/web/messages/zh.json';
import en from '../../../apps/web/messages/en.json';
import { checkCatalogs } from '../../../scripts/i18n-validation';
import {
  Stem as StemEnum,
  Branch as BranchEnum,
  Element,
  TenGod,
  NaYin,
  LifeStage,
  SolarTerm,
  PatternKeySchema,
  ShenShaNameSchema,
} from '@tianji/shared';
const now = A.now;
const chars = (p: { stem: Stem; branch: Branch }) =>
  '甲乙丙丁戊己庚辛壬癸'[STEMS.indexOf(p.stem)]! +
  '子丑寅卯辰巳午未申酉戌亥'[BRANCHES.indexOf(p.branch)]!;
const fixtures = [A, B, BS, BC, BCS, C, D, E, G, GS];
function synthetic(pairs: readonly (readonly [Stem, Branch])[]): BaziChart['pillars'] {
  const [dm, db] = pairs[2]!;
  const ps = pairs.map(([s, b], i) => makePillar(s, b, dm, db, i === 2));
  return { year: ps[0]!, month: ps[1]!, day: ps[2]!, hour: ps[3] ?? null };
}
function sample(pairs: readonly (readonly [Stem, Branch])[]): BaziChart {
  const pillars = synthetic(pairs),
    elements = elementDistribution(pillars),
    strength = assessStrength(pillars);
  const partial = {
    ...computeBazi(normalizeBirth(A.input), { now }),
    pillars,
    dayMaster: {
      stem: pillars.day.stem,
      element: pillars.day.stemElement,
      yinYang: STEM_YIN_YANG[pillars.day.stem],
    },
    elements,
    strength,
    useGod: selectUseGod(pillars, strength, elements),
    pattern: detectPattern(pillars, strength),
    relations: natalRelations(pillars),
    shenSha: computeShenSha(pillars),
  };
  return { ...partial, features: computeFeatures(partial) };
}
describe('frozen complete golden charts and independent calendar expectations', () => {
  it.each(edges)('replays boundary golden $id and independent library reference', (fixture) => {
    const chart = computeBazi(normalizeBirth(fixture.input), {
      now: fixture.now,
      school: { ziHour: fixture.school as 'zi_unified' | 'zi_split', useApparentSolarTime: false },
    });
    expect(chart).toMatchObject(fixture.chart);
    expect(
      [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour!].map(chars),
    ).toEqual(Object.values(fixture.reference));
  });
  it('audits required sect mapping independently of the library late-zi semantics', () => {
    expect(BAZI_SECT).toEqual({ zi_unified: 2, zi_split: 1 });
    const lib = Solar.fromYmdHms(1985, 11, 2, 23, 40, 0).getLunar().getEightChar();
    lib.setSect(2);
    expect(lib.getDay()).toBe('乙巳');
    expect(lib.getTime()).toBe('戊子');
    lib.setSect(1);
    expect(lib.getDay()).toBe('丙午');
    expect(lib.getTime()).toBe('戊子');
  });

  it.each(fixtures.map((fixture, i) => ({ fixture, i })))(
    'replays golden chart $i',
    ({ fixture }) => {
      const birth = normalizeBirth(fixture.input);
      const chart = computeBazi(birth, {
        now,
        school: {
          ziHour: fixture.school as 'zi_unified' | 'zi_split',
          useApparentSolarTime:
            'useApparentSolarTime' in fixture ? fixture.useApparentSolarTime : true,
        },
      });
      expect(chart).toEqual(fixture.chart);
      expect(BaziChartSchema.safeParse(chart).success).toBe(true);
      expect(chart.luck.periods).toHaveLength(10);
      expect(chart.years).toHaveLength(21);
      expect(chart.years.filter((y) => y.isCurrent)).toHaveLength(1);
      expect(chart.months).toHaveLength(12);
      const sum = Object.values(chart.elements.pct).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 6);
      expect(
        JSON.stringify(
          computeBazi(birth, {
            now,
            school: {
              ziHour: fixture.school as 'zi_unified' | 'zi_split',
              useApparentSolarTime: 'useApparentSolarTime' in fixture ? false : true,
            },
          }),
        ),
      ).toBe(JSON.stringify(chart));
    },
  );
  it.each([
    [A, ['庚午', '辛巳', '庚辰', '庚辰']],
    [B, ['乙丑', '丙戌', '丙午', '戊子']],
    [C, ['己卯', '丁丑', '壬辰', '庚戌']],
    [D, ['戊辰', '己未', '丙寅', '甲午']],
    [E, ['乙亥', '甲申', '癸未', null]],
    [G, ['己亥', '丙子', '戊子', '壬子']],
  ] as const)('matches manual four-pillar expectations', (fixture, expected) => {
    const chart = computeBazi(normalizeBirth(fixture.input), { now });
    expect(
      [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour].map((p) =>
        p ? chars(p) : null,
      ),
    ).toEqual(expected);
  });
  it('checks Fixture A raw weights by hand and DST correction', () => {
    // Metal stems 4; hidden metal .3, earth .5+.5+1+1, wood .5+.5, fire 1+1+month bonus, water .3+.3.
    expect(A.chart.elements.raw).toEqual({ metal: 4.3, earth: 3, wood: 1, fire: 3, water: 0.6 });
    expect(A.chart.strength.score).toBeCloseTo(2.9);
    expect(A.chart.solarTimeAdjust.adjusted).toBe('1990-05-15T07:19:00');
    expect(normalizeBirth(A.input).warnings.some((w) => w.code === 'W_DST_PERIOD')).toBe(true);
  });
  it('keeps Fixture B solar midnight crossing and G early zi consistent', () => {
    expect(B.chart.solarTimeAdjust.adjusted).toBe('1985-11-03T00:02:00');
    expect(B.chart).toEqual(BS.chart);
    expect(G.chart).toEqual(GS.chart);
    expect(chars(BC.chart.pillars.day as BaziChart['pillars']['day'])).toBe('丙午');
    expect(chars(BCS.chart.pillars.day as BaziChart['pillars']['day'])).toBe('乙巳');
    expect(BC.chart.pillars.hour).toEqual(
      expect.objectContaining({ stem: 'wu_stem', branch: 'zi' }),
    );
    expect(BCS.chart.pillars.hour?.stem).toBe(BC.chart.pillars.hour?.stem);
    expect(BCS.chart.pillars.hour?.branch).toBe(BC.chart.pillars.hour?.branch);
  });
  it.each([
    ['A', A, -71],
    ['C', C, -41],
    ['D', D, -61],
  ] as const)('verifies true solar correction for city %s', (id, f, minutes) => {
    expect(normalizeBirth(f.input).solarTime.offsetMinutes).toBeCloseTo(minutes, 0);
    expect(computeBazi(normalizeBirth(f.input), { now }).solarTimeAdjust.enabled).toBe(true);
  });
});
describe('solar term, late zi and luck boundaries', () => {
  it.each([39, 40, 41])('changes year/month across lichun input minute %i', (minute) => {
    const chart = computeBazi(normalizeBirth({ ...C.input, hour: 20, minute, place: undefined }), {
      now,
      school: { useApparentSolarTime: false },
    });
    expect(chars(chart.pillars.year)).toBe(minute <= 40 ? '己卯' : '庚辰');
    expect(chars(chart.pillars.month)).toBe(minute <= 40 ? '丁丑' : '戊寅');
  });
  it('checks the exact astronomical boundary at one second before/at/after', () => {
    const boundary = Solar.fromYmd(2000, 6, 1).getLunar().getJieQiTable()['立春']!;
    for (const offset of [-1, 0, 1]) {
      const time = termTime(boundary, 'Asia/Shanghai').toPlainDateTime().add({ seconds: offset });
      const lib = toSolar(time).getLunar().getEightChar();
      expect(lib.getYear()).toBe(offset < 0 ? '己卯' : '庚辰');
      expect(lib.getMonth()).toBe(offset < 0 ? '丁丑' : '戊寅');
    }
  });
  it.each([
    ['zi_unified', '丙午'],
    ['zi_split', '乙巳'],
  ] as const)('late zi %s uses expected day and next-day hour on two dates', (ziHour, expected) => {
    for (const day of [2, 3]) {
      const chart = computeBazi(normalizeBirth({ ...B.input, day, hour: 23, minute: 40 }), {
        now,
        school: { ziHour, useApparentSolarTime: false },
      });
      const civil = Solar.fromYmd(1985, 11, day).getLunar();
      const next = Solar.fromYmd(1985, 11, day).next(1).getLunar();
      expect(chars(chart.pillars.day)).toBe(
        (ziHour === 'zi_unified' ? next : civil).getDayInGanZhi(),
      );
      expect(chart.pillars.hour?.stem).toBe(fiveRat(STEMS[next.getDayGanIndex()]!, 'zi'));
      if (day === 2) expect(chars(chart.pillars.day)).toBe(expected);
    }
  });
  it.each([
    [1990, 'male', 'forward'],
    [1985, 'male', 'backward'],
    [1990, 'female', 'backward'],
    [1985, 'female', 'forward'],
  ] as const)('luck direction %i %s is %s', (year, gender, direction) => {
    const birth = normalizeBirth({ ...A.input, year, gender });
    const chart = computeBazi(birth, { now, school: { useApparentSolarTime: false } });
    expect(chart.luck.direction).toBe(direction);
    const t = birthClock(birth, false),
      frame = t.toZonedDateTime(birth.local.tz).withTimeZone('+08:00').toPlainDateTime();
    const solar = toSolar(frame),
      lunar = solar.getLunar(),
      jie = direction === 'forward' ? lunar.getNextJie() : lunar.getPrevJie();
    const mins = Math.abs(jie.getSolar().subtractMinute(solar));
    expect(chart.luck.startAge).toEqual(startAgeFromMinutes(mins));
    const yun = solar
      .getLunar()
      .getEightChar()
      .getYun(gender === 'male' ? 1 : 0, 2);
    expect(chart.luck.startAge).toEqual({
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
    });
    const dayun = yun.getDaYun(11).slice(1);
    expect(chart.luck.periods.map((p) => chars(p))).toEqual(dayun.map((p) => p.getGanZhi()));
  });
  it('checks 3 days/year, 1 day/4 months, 1 hour/5 days and truncation', () => {
    expect(startAgeFromMinutes(4320)).toEqual({ years: 1, months: 0, days: 0 });
    expect(startAgeFromMinutes(1440)).toEqual({ years: 0, months: 4, days: 0 });
    expect(startAgeFromMinutes(60)).toEqual({ years: 0, months: 0, days: 5 });
    expect(startAgeFromMinutes(11)).toEqual({ years: 0, months: 0, days: 0 });
  });
  it('selects luck at exact start and ten-year boundaries; no current luck in childhood', () => {
    const birth = normalizeBirth(A.input),
      first = computeBazi(birth, { now });
    const t = birthClock(birth, false).add(first.luck.startAge).toZonedDateTime(birth.local.tz);
    expect(
      computeBazi(birth, { now: t.subtract({ seconds: 1 }) }).luck.periods.some((p) => p.isCurrent),
    ).toBe(false);
    expect(computeBazi(birth, { now: t }).luck.periods[0]?.isCurrent).toBe(true);
    expect(computeBazi(birth, { now: t.add({ years: 10 }) }).luck.periods[1]?.isCurrent).toBe(true);
    expect(
      computeBazi(birth, { now: t.add({ years: 100 }) }).luck.periods.some((p) => p.isCurrent),
    ).toBe(false);
  });
  it('localizes worldwide term boundaries and spans contiguous months across calendar years', () => {
    const birth = normalizeBirth(D.input);
    const boundary = termTime(
      Solar.fromYmd(2000, 6, 1).getLunar().getJieQiTable()['立春']!,
      birth.local.tz,
    );
    for (const delta of [-60, 60]) {
      const t = boundary.add({ seconds: delta });
      const b = normalizeBirth({
        ...D.input,
        year: t.year,
        month: t.month,
        day: t.day,
        hour: t.hour,
        minute: t.minute,
      });
      const chart = computeBazi(b, { now, school: { useApparentSolarTime: false } });
      expect(chars(chart.pillars.year)).toBe(delta < 0 ? '己卯' : '庚辰');
    }
    const chart = computeBazi(birth, { now: '2026-01-01T00:00:00Z' });
    expect(chart.years.find((y) => y.isCurrent)?.year).toBe(2025);
    expect(chart.months[0]?.branch).toBe('yin');
    expect(chart.months[11]?.branch).toBe('chou');
    for (let i = 0; i < 11; i++)
      expect(chart.months[i]?.toDate).toBe(chart.months[i + 1]?.fromDate);
    for (const m of chart.months) expect(m.stem).toBe(fiveTiger(ganZhiAt(2025 - 4).stem, m.branch));
    expect(chart.years.some((y) => y.relationsToLuck.length > 0)).toBe(true);
  });
});
describe('hand-calculated weighted_v1, use god and simplified patterns', () => {
  it.each([
    {
      pairs: [
        ['jia', 'zi'],
        ['jia', 'zi'],
        ['jia', 'zi'],
        ['jia', 'zi'],
      ],
      score: 10,
      level: 'strong',
    },
    {
      pairs: [
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
      ],
      score: -2,
      level: 'balanced',
    },
    {
      pairs: [
        ['jia', 'chen'],
        ['jia', 'chen'],
        ['jia', 'chen'],
        ['jia', 'chen'],
      ],
      score: 3.9,
      level: 'strong',
    },
    {
      pairs: [
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['geng', 'shen'],
      ],
      score: 8.9,
      level: 'strong',
    },
    {
      pairs: [
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['jia', 'wu'],
        ['geng', 'shen'],
      ],
      score: -6.4,
      level: 'weak',
    },
    {
      pairs: [
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
      ],
      score: -1.5,
      level: 'balanced',
    },
  ])('matches score $score/$level with per-source evidence', ({ pairs, score, level }) => {
    const p = synthetic(pairs as [Stem, Branch][]),
      strength = assessStrength(p);
    expect(strength.score).toBeCloseTo(score, 8);
    expect(strength.level).toBe(level);
    expect(strength.details.reduce((n, d) => n + d.score, 0)).toBeCloseTo(score, 8);
    expect(strength.confidence).toBeCloseTo(
      1 - (p.hour ? 0 : 0.3) - (level === 'balanced' ? 0.15 : 0),
    );
  });
  it('uses winter fire/summer water as independent tags without changing strong/weak preferences', () => {
    const winter = sample([
      ['jia', 'zi'],
      ['jia', 'zi'],
      ['jia', 'zi'],
      ['jia', 'zi'],
    ]);
    expect(winter.useGod).toMatchObject({
      group: 'drain',
      favorable: ['fire', 'earth', 'metal'],
      tiaoHou: 'fire',
    });
    const summer = sample([
      ['jia', 'wu'],
      ['jia', 'wu'],
      ['jia', 'wu'],
      ['jia', 'wu'],
    ]);
    expect(summer.useGod).toMatchObject({
      group: 'balance',
      favorable: ['water'],
      tiaoHou: 'water',
    });
    const weak = sample([
      ['geng', 'shen'],
      ['geng', 'shen'],
      ['jia', 'wu'],
      ['geng', 'shen'],
    ]);
    expect(weak.useGod).toMatchObject({ group: 'support', favorable: ['wood', 'water'] });
    expect(weak.features.suspected_cong).toBe(true);
    const temperate = synthetic([
      ['jia', 'yin'],
      ['jia', 'yin'],
      ['jia', 'zi'],
    ]);
    const allElements = elementDistribution(temperate);
    expect(
      selectUseGod(temperate, { ...winter.strength, level: 'balanced' }, allElements).favorable,
    ).toHaveLength(5);
  });
  it('flags a lone unsupported day master weak', () => {
    const p = synthetic([
      ['bing', 'wu'],
      ['bing', 'wu'],
      ['ren', 'wu'],
    ]);
    const s = assessStrength(p);
    expect(s.level).toBe('weak');
  });
  it('sets 10 pattern names from month main qi, visible exposure and confidence with no hour', () => {
    const cases: readonly [Stem, Branch, BaziChart['pattern']['name']][] = [
      ['jia', 'yin', 'jian_lu'],
      ['jia', 'mao', 'yue_ren'],
      ['jia', 'si', 'shi_shen'],
      ['jia', 'wu', 'shang_guan'],
      ['jia', 'chen', 'pian_cai'],
      ['jia', 'chou', 'zheng_cai'],
      ['jia', 'shen', 'qi_sha'],
      ['jia', 'you', 'zheng_guan'],
      ['jia', 'hai', 'pian_yin'],
      ['jia', 'zi', 'zheng_yin'],
    ];
    for (const [dm, month, name] of cases) {
      const branch = BRANCHES[STEMS.indexOf(dm) % 2]!;
      const p = synthetic([
        ['jia', 'zi'],
        [BRANCHES.indexOf(month) % 2 ? 'yi' : 'jia', month],
        [dm, branch],
      ]);
      expect(detectPattern(p, assessStrength(p)).name).toBe(name);
    }
    expect(A.chart.pattern.viaStem).toBe(false);
    expect(
      sample([
        ['jia', 'yin'],
        ['jia', 'yin'],
        ['jia', 'zi'],
      ]).pattern.viaStem,
    ).toBe(true);
  });
});
describe('markers, relations and precomputed KU boolean features', () => {
  it('checks every ten-stem marker cell and opposite-branch flying blade rule', () => {
    for (const [i, dm] of STEMS.entries())
      for (const b of BRANCHES) {
        const p = synthetic([
          ['jia', b === 'mao' ? 'yin' : 'zi'],
          [BRANCHES.indexOf(b) % 2 ? 'yi' : 'jia', b],
          [dm, BRANCHES[i % 2]!],
        ]);
        const hits = computeShenSha(p);
        for (const [name, table] of Object.entries(DAY_STEM_SHA))
          expect(hits.some((h) => h.name === name && h.hitsPillar.includes('month'))).toBe(
            table[i]!.includes(b),
          );
        expect(DAY_STEM_SHA.fei_ren[i]?.[0]).toBe(oppositeBranch(DAY_STEM_SHA.yang_ren[i]![0]!));
      }
  });
  it('collects all 20 families, checks exact魁罡 days and month-de stem/branch forms', () => {
    const names = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (let m = 0; m < 12; m++) {
        const day = ganZhiAt(i),
          month = ganZhiAt(m),
          p = synthetic([
            [ganZhiAt(i + 2).stem, ganZhiAt(i + 2).branch],
            [month.stem, month.branch],
            [day.stem, day.branch],
            [ganZhiAt(i + 4).stem, ganZhiAt(i + 4).branch],
          ]);
        const hits = computeShenSha(p);
        hits.forEach((h) => names.add(h.name));
        expect(hits.some((h) => h.name === 'kui_gang')).toBe(
          KUI_GANG.some((k) => k === `${day.stem}:${day.branch}`),
        );
      }
    expect(names.size).toBe(20);
    const p = synthetic([
      ['ding', 'mao'],
      ['jia', 'yin'],
      ['jia', 'zi'],
      ['bing', 'yin'],
    ]);
    expect(computeShenSha(p)).toEqual(
      expect.arrayContaining([
        { name: 'tian_de_gui_ren', basedOn: 'month_branch', hitsPillar: ['year'] },
        { name: 'yue_de_gui_ren', basedOn: 'month_branch', hitsPillar: ['hour'] },
      ]),
    );
  });
  it('distinguishes half/full trines, duplicates, five stem combinations and four clashes', () => {
    const fire = sample([
      ['jia', 'yin'],
      ['bing', 'wu'],
      ['wu_stem', 'xu'],
      ['jia', 'yin'],
    ]);
    expect(
      fire.relations.branches.filter((r) => r.type === 'tri_combine' && r.complete),
    ).toHaveLength(2);
    expect(fire.features.san_he_huo_ju).toBe(true);
    const half = sample([
      ['jia', 'yin'],
      ['bing', 'wu'],
      ['wu_stem', 'chen'],
    ]);
    expect(half.features.san_he_huo_ju).toBe(false);
    expect(half.relations.branches.some((r) => r.type === 'tri_combine' && !r.complete)).toBe(true);
    for (const [a, b] of [
      ['jia', 'ji'],
      ['yi', 'geng'],
      ['bing', 'xin'],
      ['ding', 'ren'],
      ['wu_stem', 'gui'],
    ] as [Stem, Stem][])
      expect(
        natalRelations(
          synthetic([
            [a, BRANCHES[STEMS.indexOf(a) % 2]!],
            [b, BRANCHES[STEMS.indexOf(b) % 2]!],
            ['jia', 'zi'],
          ]),
        ).stems.some((r) => r.type === 'combine'),
      ).toBe(true);
    for (const [a, b] of [
      ['jia', 'geng'],
      ['yi', 'xin'],
      ['bing', 'ren'],
      ['ding', 'gui'],
    ] as [Stem, Stem][])
      expect(
        natalRelations(
          synthetic([
            [a, BRANCHES[STEMS.indexOf(a) % 2]!],
            [b, BRANCHES[STEMS.indexOf(b) % 2]!],
            ['jia', 'zi'],
          ]),
        ).stems.some((r) => r.type === 'clash'),
      ).toBe(true);
  });
  it('evaluates features from explicit evidence; coverage across representative symbolic configurations', () => {
    const seen = new Set<string>();
    // Exhaustive symbolic month/day samples plus deterministic cycles exercise both truth values of composite features.
    for (let i = 0; i < 60; i++)
      for (let j = 0; j < 12; j++) {
        const ps = [ganZhiAt(i), ganZhiAt(j), ganZhiAt(i + 20), ganZhiAt(i + j + 40)];
        const p = synthetic(ps.map((x) => [x.stem, x.branch])),
          strength = assessStrength(p),
          elements = elementDistribution(p);
        const partial = {
          ...A.chart,
          pillars: p,
          dayMaster: {
            stem: p.day.stem,
            element: p.day.stemElement,
            yinYang: STEMS.indexOf(p.day.stem) % 2 ? 'yin' : 'yang',
          },
          elements,
          strength,
          pattern: detectPattern(p, strength),
          useGod: selectUseGod(p, strength, elements),
          relations: natalRelations(p),
          shenSha: computeShenSha(p),
        } as Omit<BaziChart, 'features'>;
        const f = computeFeatures(partial);
        for (const [key, value] of Object.entries(f)) seen.add(`${key}:${value}`);
        expect(Object.values(f).every((v) => typeof v === 'boolean')).toBe(true);
        const gods = [
          ...p.year.hiddenStems,
          ...p.month.hiddenStems,
          ...p.day.hiddenStems,
          ...p.hour!.hiddenStems,
        ]
          .map((h) => h.tenGod)
          .concat(
            [p.year.tenGod, p.month.tenGod, p.hour!.tenGod].filter((g) => g !== 'day_master'),
          );
        expect(f.guan_sha_hun_za).toBe(gods.includes('zheng_guan') && gods.includes('qi_sha'));
        expect(f.has_root).toBe(
          [p.year, p.month, p.day, p.hour!].some((q) =>
            q.hiddenStems.some((h) => ['bi_jian', 'jie_cai'].includes(h.tenGod)),
          ),
        );
      }
    for (const key of [
      'guan_sha_hun_za',
      'cai_duo_shen_ruo',
      'bi_jian_heavy',
      'sha_yin_xiang_sheng',
      'has_clash',
      'has_punishment',
      'has_tao_hua',
      'has_yi_ma',
    ])
      expect(seen.has(`${key}:true`)).toBe(true);
    for (const [branches, key] of [
      [['shen', 'zi', 'chen'], 'san_he_shui_ju'],
      [['hai', 'mao', 'wei'], 'san_he_mu_ju'],
      [['si', 'you', 'chou'], 'san_he_jin_ju'],
    ] as const) {
      const p = synthetic(branches.map((b) => [BRANCHES.indexOf(b) % 2 ? 'yi' : 'jia', b]));
      expect(
        computeFeatures({ ...A.chart, pillars: p, relations: natalRelations(p) } as Omit<
          BaziChart,
          'features'
        >)[key],
      ).toBe(true);
    }
  });
});
describe('strict API, warnings, immutable inputs and schema rejection', () => {
  it('handles unknown hour, unknown gender, no place and customized range', () => {
    const birth = normalizeBirth(E.input),
      before = JSON.stringify(birth),
      result = compute({ system: 'bazi', birth, now, options: { yearsAround: 0 } });
    expect(result.meta.warnings.map((w) => w.code)).toEqual([
      'W_NO_HOUR_PILLAR',
      'W_GENDER_DEFAULTED',
    ]);
    expect(result.meta.schoolUsed).toEqual({
      ziHour: 'zi_unified',
      useApparentSolarTime: true,
      strengthMethod: 'weighted_v1',
    });
    expect((result.chart as BaziChart).pillars.hour).toBeNull();
    expect((result.chart as BaziChart).years).toHaveLength(1);
    expect(JSON.stringify(birth)).toBe(before);
    expect(
      computeBazi(normalizeBirth({ ...A.input, place: undefined }), { now }).solarTimeAdjust,
    ).toMatchObject({ enabled: false, offsetMinutes: null, adjusted: null });
  });
  it('accepts caller Temporal now and rejects invalid birth, now, school and range', () => {
    const birth = normalizeBirth(A.input);
    expect(computeBazi(birth, { now: Temporal.Instant.from(now) })).toEqual(
      computeBazi(birth, { now }),
    );
    expect(
      computeBazi(birth, { now: Temporal.Instant.from(now).toZonedDateTimeISO('Asia/Shanghai') }),
    ).toEqual(computeBazi(birth, { now }));
    expect(() =>
      computeBazi({ ...birth, local: { ...birth.local, hour: 25 } } as NormalizedBirth, { now }),
    ).toThrow(EngineError);
    expect(() => computeBazi(birth, { now: 'invalid' })).toThrow(EngineError);
    expect(() => computeBazi(birth, { now, yearsAround: -1 })).toThrow(EngineError);
    expect(() =>
      computeBazi(birth, { now, school: { ziHour: 'invalid' as 'zi_unified' } }),
    ).toThrow(expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }));
    expect(() =>
      compute({ system: 'bazi', birth, now, options: { school: { unknown: true } } }),
    ).toThrow(expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }));
  });
  it('rejects translated enum values, invalid confidence and missing boolean KU fields', () => {
    expect(
      BaziChartSchema.safeParse({ ...A.chart, strength: { ...A.chart.strength, confidence: 1.1 } })
        .success,
    ).toBe(false);
    expect(
      BaziChartSchema.safeParse({ ...A.chart, dayMaster: { ...A.chart.dayMaster, stem: '戊' } })
        .success,
    ).toBe(false);
    expect(BaziChartSchema.safeParse({ ...A.chart, features: {} }).success).toBe(false);
  });
});

describe('next-intl bilingual keys', () => {
  it('provides next-intl catalogs for all output names and emitted rationale/warning keys', () => {
    const keys: string[] = [];
    for (const [group, values] of Object.entries({
      stems: StemEnum,
      branches: BranchEnum,
      elements: Element,
      tenGods: TenGod,
      naYin: NaYin,
      lifeStages: LifeStage,
      solarTerms: SolarTerm,
    }))
      keys.push(...Object.values(values).map((v) => `bazi.${group}.${v}`));
    keys.push(
      ...PatternKeySchema.options.map((v) => `bazi.patterns.${v}`),
      ...ShenShaNameSchema.options.map((v) => `bazi.shenSha.${v}`),
    );
    for (const f of fixtures) keys.push(...f.chart.useGod.rationale, ...f.chart.pattern.notes);
    const weak = sample([
      ['geng', 'shen'],
      ['geng', 'shen'],
      ['jia', 'wu'],
      ['geng', 'shen'],
    ]);
    keys.push(
      ...weak.pattern.notes,
      ...baziWarnings(normalizeBirth(E.input), weak).map((w) => w.messageKey),
    );
    expect(
      baziWarnings(normalizeBirth(E.input), weak).some((w) => w.code === 'W_SUSPECTED_CONG'),
    ).toBe(true);
    expect(checkCatalogs(zh, en)).toEqual([]);
    for (const messages of [zh, en])
      for (const key of keys) expect((messages as Record<string, string>)[key]).toBeTruthy();
  });
});
