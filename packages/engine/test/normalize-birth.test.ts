import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Lunar, LunarYear } from 'lunar-typescript';
import { BirthInputSchema, NormalizedBirthSchema } from '@tianji/shared';
import {
  normalizeBirth,
  EngineError,
  apparentSolarTime,
  noaaSolarOffset,
  noaaEquationOfTime,
} from '../src';
import A from './fixtures/birth/A.json';
import B from './fixtures/birth/B.json';
import C from './fixtures/birth/C.json';
import D from './fixtures/birth/D.json';
import E from './fixtures/birth/E.json';
import F from './fixtures/birth/F.json';
import G from './fixtures/birth/G.json';

const errorCode = (input: unknown, code: string) => {
  try {
    normalizeBirth(input);
    throw new Error('expected failure');
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
  }
};
// DESIGN-GAP: F/G omit gender and coordinates; use unspecified and approximate city centers.
// DESIGN-GAP: B's apparent solar clock crosses midnight (00:02); retain it rather than force a late-zi boundary.
describe('document birth fixtures', () => {
  for (const [name, input] of Object.entries({ A, B, C, D, E, G })) {
    it(`snapshots ${name} deterministically`, () => {
      const result = normalizeBirth(input);
      expect(result).toMatchSnapshot();
      expect(JSON.stringify(normalizeBirth(input))).toBe(JSON.stringify(result));
      expect(NormalizedBirthSchema.safeParse(result).success).toBe(true);
    });
  }
  it('preserves F as an invalid leap month instead of changing its year', () => {
    // DESIGN-GAP: Document F is impossible: 1992 has no leap month. Keep its input and snapshot its specified validation error.
    expect(LunarYear.fromYear(F.year).getLeapMonth()).toBe(0);
    try {
      normalizeBirth(F);
    } catch (error) {
      expect(error).toMatchSnapshot();
    }
    errorCode(F, 'E_LUNAR_NO_LEAP_MONTH');
  });
  // DESIGN-GAP: Fixture A follows historical IANA DST per 04; the bazi example omits the extra hour.
  it('observes mainland DST for fixture A despite the example correction in bazi §9', () => {
    expect(normalizeBirth(A).utc).toBe('1990-05-14T23:30:00Z');
    expect(normalizeBirth(A).solarTime.local).toMatchObject({ hour: 7, minute: 19 });
    expect(normalizeBirth(A).warnings.map((w) => w.code)).toContain('W_DST_PERIOD');
    expect(normalizeBirth(D).solarTime.local).toMatchObject({ hour: 12, minute: 58 });
  });
});
describe('calendar, timezone and uncertainty boundaries', () => {
  it('converts a real leap month and checks its 29/30 day limit', () => {
    const input = { ...F, year: 1993, month: 3 };
    const result = normalizeBirth(input);
    const expected = Lunar.fromYmd(1993, -3, 15).getSolar();
    expect(result.local).toMatchObject({
      year: expected.getYear(),
      month: expected.getMonth(),
      day: expected.getDay(),
    });
    expect(result.lunar).toMatchObject({ year: 1993, month: 3, isLeap: true, day: 15 });
    expect(normalizeBirth({ ...F, isLeapMonth: false }).lunar.isLeap).toBe(false);
    errorCode({ ...input, day: 31 }, 'E_INVALID_INPUT');
  });
  it('uses local noon and suppresses solar clock when time is unknown', () => {
    const result = normalizeBirth({ ...E, hour: 23, minute: 40 });
    expect(normalizeBirth({ ...E, hour: 100, minute: null }).local.hour).toBeNull();
    expect(result.local.hour).toBeNull();
    expect(result.local.minute).toBeNull();
    expect(result.utc).toBe('1995-08-20T02:00:00Z');
    expect(result.jd).toBe(2449949.5833333335);
    expect(result.solarTime).toMatchObject({ enabled: true, local: null, offsetMinutes: null });
    expect(normalizeBirth({ ...A, hour: undefined }).timeUnknown).toBe(true);
    expect(normalizeBirth({ ...A, minute: undefined }).timeUnknown).toBe(true);
  });
  it('uses zh/en defaults without inventing coordinates', () => {
    for (const [locale, tz] of [
      ['zh', 'Asia/Shanghai'],
      ['en', 'UTC'],
    ] as const) {
      const result = normalizeBirth({ ...G, place: undefined }, locale);
      expect(result.place).toEqual({ lat: null, lng: null, tz });
      expect(result.solarTime.enabled).toBe(false);
      expect(result.solarTime.local).toBeNull();
      expect(result.warnings).toEqual([
        { code: 'W_NO_PLACE', messageKey: 'engine.warnings.W_NO_PLACE' },
      ]);
    }
    expect(normalizeBirth({ ...E, place: undefined }, 'en').utc).toBe('1995-08-20T12:00:00Z');
  });
  it('handles DST gaps/overlaps using Temporal compatible, and fractional historical offsets', () => {
    const ny = { ...D, year: 2024, month: 3, day: 10, hour: 2, minute: 30 };
    expect(normalizeBirth(ny).utc).toBe('2024-03-10T07:30:00Z');
    expect(normalizeBirth(ny).local).toMatchObject({ hour: 3, minute: 30 });
    expect(normalizeBirth(ny).solarTime.local?.hour).toBe(2);
    expect(normalizeBirth({ ...ny, month: 11, day: 3, hour: 1 }).utc).toBe('2024-11-03T05:30:00Z');
    expect(
      normalizeBirth({ ...G, year: 1900, place: { ...G.place, tz: 'Asia/Kolkata' } }).utc,
    ).toBe('1899-12-31T19:08:50Z');
    expect(normalizeBirth({ ...E, year: 2024, month: 1, day: 15 }).warnings[0]?.code).toBe(
      'W_DST_PERIOD',
    );
  });
  it.each([
    null,
    {},
    { ...A, year: 1899 },
    { ...A, year: 2101 },
    { ...A, year: 2000.5 },
    { ...A, month: 2, day: 30 },
    { ...A, place: { ...A.place, tz: 'Invalid/Zone' } },
    { ...A, place: { ...A.place, lat: 91 } },
    { ...A, hour: 24 },
    { ...A, place: { ...A.place, tz: '+08:00' } },
    { ...A, isLeapMonth: true },
    { ...F, year: 2100, month: 12, isLeapMonth: false, day: 30 },
  ])('rejects invalid/out-of-range input without exposing birth values: %j', (input) => {
    expect(() => normalizeBirth(input)).toThrow(EngineError);
  });
  it('accepts inclusive bounds, validates locale and schema invariants', () => {
    expect(normalizeBirth({ ...G, year: 1900 }).local.year).toBe(1900);
    expect(normalizeBirth({ ...G, year: 2100 }).local.year).toBe(2100);
    expect(() => normalizeBirth(A, 'fr' as 'zh')).toThrow(EngineError);
    expect(BirthInputSchema.safeParse({ ...A, extra: true }).success).toBe(false);
    expect(BirthInputSchema.safeParse({ ...A, year: 1900, month: 2, day: 29 }).success).toBe(false);
    expect(BirthInputSchema.safeParse({ ...A, year: 2000, month: 2, day: 29 }).success).toBe(true);
    expect(BirthInputSchema.safeParse({ ...A, year: 2024, month: 2, day: 29 }).success).toBe(true);
    const valid = normalizeBirth(A);
    expect(
      NormalizedBirthSchema.safeParse({ ...valid, local: { ...valid.local, month: 2, day: 30 } })
        .success,
    ).toBe(false);
    expect(
      NormalizedBirthSchema.safeParse({
        ...valid,
        solarTime: {
          ...valid.solarTime,
          local: { year: 2000, month: 2, day: 30, hour: 12, minute: 0 },
        },
      }).success,
    ).toBe(false);
    expect(NormalizedBirthSchema.safeParse({ ...valid, timeUnknown: true }).success).toBe(false);
    expect(
      NormalizedBirthSchema.safeParse({ ...valid, local: { ...valid.local, minute: null } })
        .success,
    ).toBe(false);
    expect(
      NormalizedBirthSchema.safeParse({ ...valid, place: { ...valid.place, tz: 'UTC' } }).success,
    ).toBe(false);
  });
});
describe('solar time and independent NOAA equations', () => {
  it.each([
    ['Beijing', 'Asia/Shanghai', 116.4],
    ['New York', 'America/New_York', -74.01],
    ['Sydney', 'Australia/Sydney', 151.21],
  ] as const)('agrees within one minute in %s for leap/non-leap seasons', (_, tz, longitude) => {
    for (const year of [1988, 1990, 2000, 2023, 2024]) {
      for (const month of [1, 2, 4, 5, 7, 10, 12]) {
        const time = Temporal.ZonedDateTime.from({ year, month, day: 15, hour: 12, timeZone: tz });
        expect(
          Math.abs(
            apparentSolarTime(time, longitude).offsetMinutes - noaaSolarOffset(time, longitude),
          ),
        ).toBeLessThanOrEqual(1);
      }
    }
  });
  it('matches published NOAA coefficients at gamma=0', () => {
    expect(noaaEquationOfTime(Temporal.PlainDateTime.from('2023-01-01T12:00'))).toBeCloseTo(
      -2.90416896,
      8,
    );
  });
  it('carries correction across year and day boundaries including the date line', () => {
    const start = Temporal.ZonedDateTime.from('2024-01-01T00:01[Asia/Shanghai]');
    expect(apparentSolarTime(start, 90).local).toMatchObject({
      year: 2023,
      month: 12,
      day: 31,
      hour: 21,
    });
    const end = Temporal.ZonedDateTime.from('2024-12-31T23:59[UTC]');
    expect(apparentSolarTime(end, 180).local).toMatchObject({ year: 2025, month: 1, day: 1 });
    const dateLine = Temporal.ZonedDateTime.from('2024-01-01T12:00[Pacific/Kiritimati]');
    expect(apparentSolarTime(dateLine, -157.4).offsetMinutes).toBeLessThan(-1440);
  });
});
