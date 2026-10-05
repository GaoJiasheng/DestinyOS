import { BaziChartSchema, type BaziChart } from '@tianji/shared';
import { Solar } from 'lunar-typescript';
import { describe, expect, it } from 'vitest';
import { BAZI_SECT, computeBazi, normalizeBirth } from '../src';
import { chars, fixtures, now } from './bazi-fixtures';
import A from './fixtures/bazi/A.json';
import BCS from './fixtures/bazi/B-clock-split.json';
import BC from './fixtures/bazi/B-clock.json';
import BS from './fixtures/bazi/B-split.json';
import B from './fixtures/bazi/B.json';
import C from './fixtures/bazi/C.json';
import D from './fixtures/bazi/D.json';
import E from './fixtures/bazi/E.json';
import GS from './fixtures/bazi/G-split.json';
import G from './fixtures/bazi/G.json';
import edges from './fixtures/bazi/edges.json';

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
