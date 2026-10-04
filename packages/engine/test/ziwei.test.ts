import { describe, expect, it, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import { astro } from 'iztro';
import { mapStar, mapBrightness, mapStem, mapBranch } from '../src/ziwei/mapping';
import {
  computeZiwei,
  normalizeBirth,
  validateZiweiChart,
  ziweiTimeIndex,
  BRANCHES,
  STEMS,
  ganZhiIndex,
  naYin,
  type ZiweiSchool,
} from '../src';
import { ZiweiChartSchema, type BirthInput, type ZiweiChart } from '@tianji/shared';
import A from './fixtures/birth/A.json';
import B from './fixtures/birth/B.json';
import F from './fixtures/birth/F.json';
import E from './fixtures/birth/E.json';
import goldens from './fixtures/ziwei/goldens.json';
import goldenA from './fixtures/ziwei/A.json';
import goldenB from './fixtures/ziwei/B.json';
import goldenF from './fixtures/ziwei/F-valid.json';
const validF = F;
vi.mock('iztro', async (importOriginal) => {
  const original = await importOriginal<typeof import('iztro')>();
  return { ...original, astro: { ...original.astro, bySolar: vi.fn(original.astro.bySolar) } };
});
const now = '2026-10-04T00:00:00Z';
const run = (raw: unknown, school?: ZiweiSchool) =>
  computeZiwei({ birth: normalizeBirth(raw), now, options: { school } });
const names = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '仆役',
  '官禄',
  '田宅',
  '福德',
  '父母',
];
const lunarBirth = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  gender: BirthInput['gender'] = 'male',
) => ({ calendar: 'lunar', year, month, day, hour, minute: 0, timeUnknown: false, gender });
describe('iztro adapter golden fixtures and late Zi/leap handling', () => {
  it.each(goldens.cases)(
    'frozen chart fragment $birth.year-$birth.month at $birth.hour',
    ({ birth, school, now, expected }) => {
      const chart = computeZiwei({ birth: normalizeBirth(birth), options: { school }, now });
      expect({
        basics: chart.basics,
        ziweiBranch: chart.palaces.find((p) => p.majorStars.some((s) => s.key === 'zi_wei'))!
          .branch,
        life: chart.palaces[0],
        horoscope: chart.horoscope,
      }).toEqual(expected);
    },
  );
  it.each([
    [A, goldenA],
    [B, goldenB],
    [validF, goldenF],
  ])('matches frozen fixture and entire iztro palace output', (raw, expected) => {
    const birth = normalizeBirth(raw),
      clock = birth.solarTime.local!,
      chart = run(raw);
    expect(chart).toEqual(expected);
    expect(ZiweiChartSchema.safeParse(chart).success).toBe(true);
    astro.config({
      algorithm: 'default',
      yearDivide: 'normal',
      horoscopeDivide: 'normal',
      dayDivide: 'forward',
      ageDivide: 'normal',
    });
    const reference = astro.bySolar(
      `${clock.year}-${clock.month}-${clock.day}`,
      ziweiTimeIndex(clock.hour),
      birth.gender === 'female' ? '女' : '男',
      true,
      'zh-CN',
    );
    for (const palace of chart.palaces) {
      const p = reference.palaces.find((p) => p.name === names[palace.index])!;
      expect(palace.branch).toBe(mapBranch(p.earthlyBranch));
      expect(palace.stem).toBe(mapStem(p.heavenlyStem));
      expect(palace.majorStars.map((s) => [s.key, s.brightness])).toEqual(
        p.majorStars.map((s) => [mapStar(s.name), mapBrightness(s.brightness!)]),
      );
      expect(palace.minorStars.map((s) => s.key)).toEqual(p.minorStars.map((s) => mapStar(s.name)));
      expect(palace.adjectiveStars).toEqual(p.adjectiveStars.map((s) => mapStar(s.name)));
      expect([palace.decadal.fromAge, palace.decadal.toAge]).toEqual(p.decadal.range);
      expect(palace.ages).toEqual(p.ages);
    }
    const h = reference.horoscope('2026-10-4', 4);
    expect(chart.horoscope.decadal.mutagens).toEqual(
      Object.fromEntries(
        ['lu', 'quan', 'ke', 'ji'].map((k, i) => [k, mapStar(h.decadal.mutagen[i]!)]),
      ),
    );
    expect(chart.horoscope.yearly.mutagens).toEqual(
      Object.fromEntries(
        ['lu', 'quan', 'ke', 'ji'].map((k, i) => [k, mapStar(h.yearly.mutagen[i]!)]),
      ),
    );
  });
  it('Fixture A has 辰, 庚午, fire six, and the documented 庚 transformations', () => {
    const chart = run(A);
    expect(chart.basics).toMatchObject({
      lunar: { month: 4, day: 21, hourBranch: 'chen' },
      yearStem: 'geng',
      yearBranch: 'wu',
      fiveElementsClass: { name: 'fire_6', number: 6 },
      soulPalaceBranch: 'chou',
    });
    const stars = chart.palaces.flatMap((p) => [...p.majorStars, ...p.minorStars]);
    expect(
      stars
        .filter((s) => s.mutagen)
        .map((s) => [s.key, s.mutagen])
        .sort(),
    ).toEqual(
      [
        ['tai_yang', 'lu'],
        ['wu_qu', 'quan'],
        ['tai_yin', 'ke'],
        ['tian_tong', 'ji'],
      ].sort(),
    );
  });
  it('Fixture B solar correction crosses midnight without a second date advance; clock mode uses index 12', () => {
    // DESIGN-GAP: Actual common correction puts B on Nov 3 early Zi, contrary to the document's late-Zi assumption.
    const birth = normalizeBirth(B),
      clock = birth.solarTime.local!;
    expect(clock).toMatchObject({ year: 1985, month: 11, day: 3, hour: 0 });
    const lunar = Solar.fromYmd(clock.year, clock.month, clock.day).getLunar();
    expect(run(B).basics.lunar).toMatchObject({
      day: lunar.getDay(),
      month: Math.abs(lunar.getMonth()),
      hourBranch: 'zi',
    });
    const late = run(B, { useApparentSolarTime: false });
    expect(late.basics.lunar).toMatchObject({
      day: lunar.getDay(),
      month: Math.abs(lunar.getMonth()),
      hourBranch: 'zi',
    });
    const reference = astro.bySolar('1985-11-2', 12, '女', true, 'zh-CN');
    expect(late.basics.soulPalaceBranch).toBe(mapBranch(reference.earthlyBranchOfSoulPalace));
  });
  it('Fixture F leap March splits at fifteen and as_next differs', () => {
    expect(() => run({ ...F, year: 1992, month: 6 })).toThrow(
      expect.objectContaining({ code: 'E_LUNAR_NO_LEAP_MONTH' }),
    );
    expect(run(validF)).toEqual(run(validF, { leapMonth: 'as_prev' }));
    expect(run(validF, { leapMonth: 'as_next' }).basics.soulPalaceBranch).not.toBe(
      run(validF).basics.soulPalaceBranch,
    );
    const last = run({ ...validF, day: 29 }, { leapMonth: 'as_next' });
    expect(last).toEqual(run({ ...validF, day: 29 }));
    const later = { ...validF, day: 16 };
    expect(run(later).palaces.map((p) => p.majorStars)).toEqual(
      run(later, { leapMonth: 'as_next' }).palaces.map((p) => p.majorStars),
    );
    expect(run(later, { leapMonth: 'as_prev' }).basics.soulPalaceBranch).not.toBe(
      run(later).basics.soulPalaceBranch,
    );
  });
  it('rejects unknown time, invalid inputs, school and now with safe errors', () => {
    expect(() => run(E)).toThrow(expect.objectContaining({ code: 'E_REQUIRES_BIRTH_TIME' }));
    const birth = normalizeBirth(A);
    expect(() => computeZiwei({ birth: { ...birth, timeUnknown: true }, now })).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    );
    expect(() => computeZiwei({ birth, now: 'bad' })).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    );
    expect(() => run(A, { leapMonth: 'bad' as 'as_prev' })).toThrow(
      expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }),
    );
    expect(() => computeZiwei({ birth, now: '2300-01-01T00:00:00Z' })).toThrow(
      expect.objectContaining({ code: 'E_DATE_OUT_OF_RANGE' }),
    );
    expect(() => computeZiwei({ birth, now: '1980-01-01T00:00:00Z' })).toThrow(
      expect.objectContaining({ code: 'E_DATE_OUT_OF_RANGE' }),
    );
  });
  it('uses common solar correction or explicit clock time, and respects explicit Temporal zones', () => {
    const input = { ...A, hour: 1, minute: 5 };
    expect(run(input).basics.lunar.hourBranch).toBe('zi');
    expect(run(input, { useApparentSolarTime: false }).basics.lunar.hourBranch).toBe('chou');
    const birth = normalizeBirth(A);
    expect(computeZiwei({ birth, now: Temporal.Instant.from(now) })).toEqual(run(A));
    expect(
      computeZiwei({ birth, now: Temporal.ZonedDateTime.from('2026-10-04T08:00[Asia/Shanghai]') }),
    ).toEqual(run(A));
  });
  it('isolates and restores iztro global overrides and failures', () => {
    const expected = run(A);
    astro.config({
      algorithm: 'zhongzhou',
      dayDivide: 'current',
      yearDivide: 'exact',
      mutagens: { 庚: ['紫微', '天机', '天府', '太阴'] },
      brightness: { 紫微: Array.from({ length: 12 }, () => '陷' as const) },
    });
    const config = structuredClone(astro.getConfig());
    expect(run(A)).toEqual(expected);
    expect(astro.getConfig()).toEqual(config);
    const spy = vi.spyOn(astro, 'bySolar').mockImplementation(() => {
      throw Error('bad library');
    });
    expect(() => run(A)).toThrow(expect.objectContaining({ code: 'E_ENGINE_INTERNAL' }));
    expect(astro.getConfig()).toEqual(config);
    spy.mockRestore();
    for (const key of Object.keys(astro.getConfig().mutagens))
      Reflect.deleteProperty(astro.getConfig().mutagens, key);
    for (const key of Object.keys(astro.getConfig().brightness))
      Reflect.deleteProperty(astro.getConfig().brightness, key);
    astro.config({ algorithm: 'default', dayDivide: 'forward', yearDivide: 'normal' });
  });
  it('exposes iztro childhood palace before bureau starting age', () => {
    const birth = normalizeBirth({ ...A, year: 2026 });
    const chart = computeZiwei({ birth, now });
    expect(chart.horoscope.decadal.fromAge).toBe(1);
    expect(chart.horoscope.decadal.toAge).toBe(chart.basics.fiveElementsClass.number - 1);
  });
  it.each(Array.from({ length: 24 }, (_, hour) => hour))(
    'timeIndex hour %i includes early and late Zi',
    (hour) => expect(ziweiTimeIndex(hour)).toBe(Math.floor((hour + 1) / 2)),
  );
  it.each([-1, 24, 1.5, NaN])('rejects invalid clock hour %s', (hour) =>
    expect(() => ziweiTimeIndex(hour)).toThrow(),
  );
});
describe('§9 independent calendar and star-table checks', () => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    'life/body month %i × all twelve hours',
    (month) => {
      for (let hour = 0; hour < 12; hour++) {
        const chart = run(lunarBirth(1991, month, 1, hour * 2));
        expect(chart.basics.soulPalaceBranch).toBe(BRANCHES[(month + 1 - hour + 12) % 12]);
        expect(chart.basics.bodyPalaceBranch).toBe(BRANCHES[(month + 1 + hour) % 12]);
      }
    },
  );
  it('five-element bureau matches Na Yin for all sixty palace stem/branch pairs', () => {
    const seen = new Set<number>();
    for (let year = 1990; year < 2000; year++)
      for (let hour = 0; hour < 12; hour++) {
        const chart = run(lunarBirth(year, 4, 1, hour * 2));
        const life = chart.palaces[0]!,
          index = ganZhiIndex(life.stem, life.branch);
        seen.add(index);
        const element = naYin(life.stem, life.branch).split('_').at(-1)!;
        const number: Record<string, number> = { shui: 2, mu: 3, jin: 4, tu: 5, huo: 6 };
        expect(chart.basics.fiveElementsClass.number).toBe(number[element]);
      }
    expect(seen.size).toBe(60);
  });
  // DESIGN-GAP: Exhaustive 150-chart placement checks need a longer per-test deadline under combined V8 coverage.
  it('Zi Wei placement covers five bureaus × all thirty lunar days; decades cover five bureaus × both directions', () => {
    const candidates = new Map<number, { year: number; hour: number }>();
    for (let year = 1990; year < 2000; year++)
      for (let hour = 0; hour < 12; hour++) {
        try {
          normalizeBirth(lunarBirth(year, 4, 30, hour * 2));
        } catch {
          continue;
        }
        const chart = run(lunarBirth(year, 4, 1, hour * 2));
        candidates.set(chart.basics.fiveElementsClass.number, { year, hour: hour * 2 });
      }
    expect(candidates.size).toBe(5);
    for (const [bureau, { year, hour }] of candidates) {
      for (let day = 1; day <= 30; day++) {
        const chart = run(lunarBirth(year, 4, day, hour));
        const added = (bureau - (day % bureau)) % bureau,
          quotient = (day + added) / bureau;
        const expected =
          BRANCHES[(((2 + quotient - 1 + (added % 2 ? -added : added)) % 12) + 12) % 12]!;
        expect(
          chart.palaces.find((p) => p.majorStars.some((s) => s.key === 'zi_wei'))!.branch,
        ).toBe(expected);
      }
      for (const gender of ['male', 'female'] as const) {
        const chart = run(lunarBirth(year, 4, 1, hour, gender));
        expect(chart.palaces[0]!.decadal.fromAge).toBe(bureau);
        const yang = STEMS.indexOf(chart.basics.yearStem) % 2 === 0,
          direction = yang === (gender === 'male') ? 1 : -1;
        const life = BRANCHES.indexOf(chart.basics.soulPalaceBranch);
        for (let i = 0; i < 12; i++)
          expect(
            chart.palaces.find(
              (p) => BRANCHES.indexOf(p.branch) === (life + i * direction + 120) % 12,
            )!.decadal.fromAge,
          ).toBe(bureau + i * 10);
      }
    }
  }, 30_000);
  it.each(
    [
      '廉贞 破军 武曲 太阳',
      '天机 天梁 紫微 太阴',
      '天同 天机 文昌 廉贞',
      '太阴 天同 天机 巨门',
      '贪狼 太阴 右弼 天机',
      '武曲 贪狼 天梁 文曲',
      '太阳 武曲 太阴 天同',
      '巨门 太阳 文曲 文昌',
      '天梁 紫微 左辅 武曲',
      '破军 巨门 太阴 贪狼',
    ].map((table, i) => [i, table] as const),
  )('four transformations for year stem %i', (index, table) => {
    const chart = run(lunarBirth(1984 + index, 4, 1));
    const stars = chart.palaces.flatMap((p) => [...p.majorStars, ...p.minorStars]);
    expect(['lu', 'quan', 'ke', 'ji'].map((m) => stars.find((s) => s.mutagen === m)!.key)).toEqual(
      table.split(' ').map(mapStar),
    );
  });
});
describe('chart and mapping integrity failures', () => {
  it('accepts good output and rejects corrupt stars, palaces and decades', () => {
    const chart = run(A);
    validateZiweiChart(chart);
    const mutations: ((chart: ZiweiChart) => void)[] = [
      (c) => {
        c.palaces.pop();
      },
      (c) => {
        c.palaces[0]!.majorStars.push({ key: 'zi_wei', brightness: 'wang' });
      },
      (c) => {
        c.palaces[0]!.key = 'parents';
      },
      (c) => {
        c.palaces[0]!.branch = c.palaces[1]!.branch;
      },
      (c) => {
        c.palaces[0]!.decadal.toAge++;
      },
      (c) => {
        c.palaces[1]!.decadal.fromAge++;
      },
      (c) => {
        c.palaces[0]!.decadal.toYear++;
      },
      (c) => {
        c.palaces[0]!.isBodyPalace = true;
        c.palaces[1]!.isBodyPalace = true;
      },
      (c) => {
        c.basics.fiveElementsClass.number = 2;
      },
      (c) => {
        for (const p of c.palaces) p.majorStars = p.majorStars.filter((s) => s.key !== 'zi_wei');
      },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(chart);
      mutate(bad);
      expect(() => validateZiweiChart(bad)).toThrow(
        expect.objectContaining({ code: 'E_ENGINE_INTERNAL' }),
      );
    }
  });
  it('rejects unrecognized star/brightness/stem/branch labels', () => {
    for (const map of [mapStar, mapBrightness, mapStem, mapBranch])
      expect(() => map('invalid')).toThrow(expect.objectContaining({ code: 'E_ENGINE_INTERNAL' }));
    expect(() => mapStem('')).toThrow();
    expect(() => mapBranch('')).toThrow();
  });
});
