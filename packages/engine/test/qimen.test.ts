import { Temporal } from '@js-temporal/polyfill';
import { QimenCategorySchema, QimenChartSchema, SolarTerm } from '@tianji/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compute } from '../src';
import {
  calendarAt,
  solarTermAt,
  solarTerms,
  verdictFor,
  zonedTime,
} from '../src/common/divination';
import { BRANCHES, ganZhiAt, voidBranches } from '../src/common/ganzhi';
import {
  DEITIES,
  GATES,
  JI_XING,
  JU_TABLE,
  RING,
  RU_MU,
  STARS,
  computeQimen,
  earthPlate,
  horseBranch,
  rotatingPlate,
  xunShou,
  type QimenInput,
} from '../src/qimen';
import { cast, fixtures, options } from './qimen-fixtures';

describe('Qimen independent Python baseline and documented rotating-school projection', () => {
  it.each(fixtures)('matches independent projected complete chart at $at', (fixture) => {
    expect(cast(fixture.at)).toMatchObject(fixture.documented);
  });
  it('retains 30 genuine raw kinqimen outputs covering all 24 terms and both dun', () => {
    expect(fixtures).toHaveLength(30);
    expect(new Set(fixtures.map((f) => f.documented.solarTerm.name)).size).toBe(24);
    expect(new Set(fixtures.map((f) => f.documented.dun))).toEqual(new Set(['yang', 'yin']));
    fixtures.forEach((f) => expect(f.raw['排盤方式']).toBe('拆補'));
  });
  it('preserves the documented example and exposes the raw upstream disagreement', () => {
    const c = cast('2026-10-04T15:30[Asia/Shanghai]');
    expect(c).toMatchObject({
      dun: 'yin',
      ju: 4,
      solarTerm: { name: 'qiu_fen', yuan: 'lower' },
      pillars: { day: { stem: 'xin', branch: 'hai' }, hour: { stem: 'bing', branch: 'shen' } },
      zhiFu: { star: 'tian_peng', palaceEarth: 1, palaceSky: 6 },
      zhiShi: { gate: 'xiu', palaceSky: 8 },
    });
    expect(fixtures.find((f) => f.at.startsWith('2026-10-04'))?.raw['排局']).toBe('陰遁七局上元');
  });
  it('records npm rotating assessment and 30 actual independent comparisons', () => {
    const evaluation = z
      .object({
        cases: z
          .array(z.object({ rotating: z.boolean(), mismatch: z.array(z.string()) }))
          .length(30),
      })
      .parse(
        JSON.parse(readFileSync('packages/engine/test/fixtures/qimen-npm-evaluation.json', 'utf8')),
      );
    expect(evaluation.cases.every((c) => c.rotating)).toBe(true);
    expect(evaluation.cases.some((c) => c.mismatch.length)).toBe(true);
  });
  it('verifies all 24×3 ju entries against the specified table', () => {
    const expected = [
      [8, 5, 2],
      [9, 6, 3],
      [1, 7, 4],
      [3, 9, 6],
      [4, 1, 7],
      [5, 2, 8],
      [4, 1, 7],
      [5, 2, 8],
      [6, 3, 9],
      [9, 3, 6],
      [8, 2, 5],
      [7, 1, 4],
      [2, 5, 8],
      [1, 4, 7],
      [9, 3, 6],
      [7, 1, 4],
      [6, 9, 3],
      [5, 8, 2],
      [6, 9, 3],
      [5, 8, 2],
      [4, 7, 1],
      [1, 7, 4],
      [2, 8, 5],
      [3, 9, 6],
    ];
    Object.values(SolarTerm).forEach((key, i) => expect(JU_TABLE[key]).toEqual(expected[i]));
  });
  it.each(['yang', 'yin'] as const)(
    'checks nine earth plates and all 60 hour pillars in %s',
    (dun) => {
      for (let ju = 1; ju <= 9; ju++) {
        const earth = earthPlate(dun, ju);
        expect(new Set(earth).size).toBe(9);
        expect(earth[ju - 1]).toBe('wu_stem');
        for (let h = 0; h < 60; h++) {
          const hour = ganZhiAt(h),
            xun = xunShou(hour),
            c = rotatingPlate(dun, ju, hour);
          expect(c.zhiFu.palaceEarth).toBe(earth.indexOf(xun.yi) + 1);
          expect(c.zhiFu.star).toBe(STARS[c.zhiFu.palaceEarth - 1]);
          expect(c.zhiShi.gate).toBe(
            GATES[(c.zhiFu.palaceEarth === 5 ? 2 : c.zhiFu.palaceEarth) - 1],
          );
          expect(c.palaces.find((p) => p.index === c.zhiFu.palaceSky)?.deity).toBe('zhi_fu');
          expect(new Set(c.palaces.filter((p) => p.index !== 5).map((p) => p.star)).size).toBe(8);
          expect(new Set(c.palaces.filter((p) => p.index !== 5).map((p) => p.gate)).size).toBe(8);
          expect(c.palaces.filter((p) => p.index !== 5 && p.hiddenStem)).toHaveLength(1);
          expect(c.palaces[4]).toMatchObject({ star: 'tian_qin', gate: null, deity: null });
          const ri = RING.indexOf(c.zhiFu.palaceSky as (typeof RING)[number]);
          for (let i = 0; i < 8; i++)
            expect(c.palaces[RING[(ri + (dun === 'yang' ? i : 8 - i)) % 8]! - 1]?.deity).toBe(
              DEITIES[i],
            );
        }
      }
    },
  );
  it('checks all 6 xun voids, 4 horses and six punishment instruments', () => {
    for (let x = 0; x < 6; x++) {
      const h = ganZhiAt(x * 10);
      expect(xunShou(h)).toMatchObject({
        branch: h.branch,
        yi: ['wu_stem', 'ji', 'geng', 'xin', 'ren', 'gui'][x],
      });
      expect(voidBranches(h.stem, h.branch)).toEqual(
        [
          ['xu', 'hai'],
          ['shen', 'you'],
          ['wu', 'wei'],
          ['chen', 'si'],
          ['yin', 'mao'],
          ['zi', 'chou'],
        ][x],
      );
    }
    expect(BRANCHES.map(horseBranch)).toEqual([
      'yin',
      'hai',
      'shen',
      'si',
      'yin',
      'hai',
      'shen',
      'si',
      'yin',
      'hai',
      'shen',
      'si',
    ]);
    expect(JI_XING).toEqual({ wu_stem: 3, ji: 2, geng: 8, xin: 9, ren: 4, gui: 4 });
    expect(RU_MU.geng).toBe(8);
  });
  it('preserves flags for each punishment, tomb and gate relation across all layouts', () => {
    const hit = new Set<string>();
    for (const dun of ['yang', 'yin'] as const)
      for (let ju = 1; ju <= 9; ju++)
        for (let h = 0; h < 60; h++) {
          const c = rotatingPlate(dun, ju, ganZhiAt(h));
          c.palaces.forEach((p) => p.flags.forEach((f) => hit.add(f)));
        }
    expect(hit).toEqual(
      new Set([
        'void',
        'horse',
        'fu_yin',
        'fan_yin',
        'gate_forced',
        'gate_controlled',
        'ji_xing',
        'ru_mu',
      ]),
    );
  });
  it('crosses exact solstices, all three yuan and overflow supplementation', () => {
    const terms = solarTerms(2026).filter((t) => t.time.year === 2026);
    for (const term of terms) {
      for (const [days, yuan] of [
        [1, 'upper'],
        [6, 'middle'],
        [11, 'lower'],
      ] as const) {
        const c = cast(term.time.add({ days }).toString());
        expect(c.solarTerm.yuan).toBe(yuan);
      }
      expect(solarTermAt(term.time).current.name).toBe(term.name);
      expect(solarTermAt(term.time.subtract({ seconds: 1 })).current.name).not.toBe(term.name);
    }
    for (const name of ['xia_zhi', 'dong_zhi'] as const) {
      const t = terms.find((t) => t.name === name)!.time;
      expect(cast(t.toString()).dun).toBe(name === 'xia_zhi' ? 'yin' : 'yang');
      expect(cast(t.subtract({ seconds: 1 }).toString()).dun).toBe(
        name === 'xia_zhi' ? 'yang' : 'yin',
      );
    }
    const at23 = terms
      .flatMap((t) =>
        ['America/Denver', 'America/Los_Angeles', 'Pacific/Auckland', 'Europe/London'].map((tz) =>
          t.time.withTimeZone(tz),
        ),
      )
      .find((t) => t.hour === 23)!;
    expect(at23).toBeDefined();
    expect(cast(at23.toString()).solarTerm.yuan).toBe('upper');
    expect(cast(at23.add({ days: 4 }).toString()).solarTerm.yuan).toBe('upper');
    expect(cast(at23.add({ days: 5 }).toString()).solarTerm.yuan).toBe('middle');
    const chun = terms.find((t) => t.name === 'chun_fen')!.time;
    expect(cast(chun.add({ days: 15 }).toString()).solarTerm.yuan).toBe('upper');
  });
  it('uses explicit zones, midnight zi day change, solar correction and alternate center hosting', () => {
    const early = zonedTime('2026-10-04T22:59[Asia/Shanghai]'),
      late = early.add({ minutes: 1 });
    expect(calendarAt(early).pillars.day).toEqual({ stem: 'xin', branch: 'hai' });
    expect(calendarAt(late).pillars.day).toEqual({ stem: 'ren', branch: 'zi' });
    expect(calendarAt(late).pillars.hour).toEqual({ stem: 'geng', branch: 'zi' });
    const ny = Temporal.ZonedDateTime.from('2026-06-21T04:30[America/New_York]');
    const lichun = solarTerms(2026).find((t) => t.name === 'li_chun' && t.time.year === 2026)!.time;
    for (const tz of ['America/New_York', 'Pacific/Auckland', 'UTC']) {
      const local = lichun.withTimeZone(tz);
      expect(calendarAt(local).pillars.year).toEqual(calendarAt(lichun).pillars.year);
      expect(calendarAt(local).pillars.month).toEqual(calendarAt(lichun).pillars.month);
      expect(calendarAt(local.subtract({ seconds: 1 })).pillars.month).not.toEqual(
        calendarAt(local).pillars.month,
      );
    }
    expect(() => zonedTime('2026-10-04T15:30+08:00[+08:00]')).toThrow();
    expect(solarTermAt(ny).current.name).toBe(
      solarTermAt(ny.withTimeZone('Asia/Shanghai')).current.name,
    );
    const c = computeQimen({
      at: '2026-10-04T15:30[Asia/Shanghai]',
      category: 'general',
      place: { lng: 90, tz: 'Asia/Shanghai' },
      options: { school: { ...options.school, useApparentSolarTime: true } },
    });
    expect(c.castAt.adjusted).toBeDefined();
    expect(c.pillars.hour.branch).not.toBe('shen');
    for (let h = 0; h < 60; h++)
      expect(rotatingPlate('yang', 5, ganZhiAt(h), 8).palaces.some((p) => p.hiddenStem)).toBe(true);
    expect(
      computeQimen({
        at: '2026-10-04T15:30[Asia/Shanghai]',
        category: 'general',
        options: { school: { ...options.school, centerLodge: 'gen8' } },
      }).palaces,
    ).toHaveLength(9);
  });
  it.each(QimenCategorySchema.options)(
    'evaluates %s use-gods, bounded verdict and directions on all baselines',
    (category) => {
      for (const f of fixtures) {
        const c = cast(f.at, category);
        expect(QimenChartSchema.safeParse(c).success).toBe(true);
        expect(c.useGods.some((g) => g.key === 'day_stem')).toBe(true);
        expect(c.findings.every((key) => !key.includes(':'))).toBe(true);
        expect(new Set(c.findings).size).toBe(c.findings.length);
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
        expect(c.verdict).toBe(verdictFor(c.score));
        expect(c.favorableDirections).not.toContain('center');
        expect(c.timing.favorableHours.every((b) => BRANCHES.includes(b))).toBe(true);
      }
    },
  );
  it('dispatches pure charts and rejects unsupported school/missing place/invalid input', () => {
    expect(
      compute({
        system: 'qimen',
        now: Temporal.ZonedDateTime.from('2026-10-04T15:30[Asia/Shanghai]'),
      }).chart,
    ).toEqual(cast('2026-10-04T15:30[Asia/Shanghai]'));
    expect(() =>
      computeQimen({
        at: '2026-10-04T15:30[Asia/Shanghai]',
        category: 'general',
        options: { school: { ...options.school, useApparentSolarTime: true } },
      }),
    ).toThrow(expect.objectContaining({ code: 'E_REQUIRES_PLACE' }));
    expect(() => computeQimen({ at: 'invalid', category: 'general', options })).toThrow();
    expect(() =>
      computeQimen({
        at: '2026-10-04T15:30[Asia/Shanghai]',
        category: 'general',
        options: { school: { ...options.school, layout: 'flying' } },
      } as unknown as QimenInput),
    ).toThrow(expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }));
    expect(() =>
      compute({
        system: 'qimen',
        now: '2026-10-04T07:30Z',
        options: { school: { unknown: true } },
      }),
    ).toThrow();
    expect(() =>
      compute({
        system: 'iching',
        now: '2026-10-04T07:30Z',
        options: { school: { unknown: true } },
      }),
    ).toThrow();
    expect(() =>
      computeQimen({
        at: '2026-10-04T15:30[Asia/Shanghai]',
        category: 'bad',
        options,
      } as unknown as QimenInput),
    ).toThrow();
  });
});
