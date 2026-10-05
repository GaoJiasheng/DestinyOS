import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { computeDailyRange, dailyRangeDates, computeDaily } from '../src/daily';
import { computeCalendarYear } from '../src/daily/calendar';
import { computeBazi } from '../src/bazi';
import { computeAstrology } from '../src/astrology';
import { computePositions } from '../src/astrology/ephemeris';
import { normalizeBirth, hashSeed } from '../src/common';
import { SolarTerm, BirthInputSchema } from '@tianji/shared';
import A from './fixtures/birth/A.json';
import zh from '../../../apps/web/messages/zh.json';
import en from '../../../apps/web/messages/en.json';
import tw from '../../../apps/web/messages/zh-TW.json';
const profile = BirthInputSchema.parse(A),
  birth = normalizeBirth(profile);
describe('B-06 monthly scores', () => {
  for (const tz of ['Asia/Shanghai', 'America/New_York', 'Pacific/Auckland']) {
    it(`matches every full daily report score, including DST, in ${tz}`, () => {
      const now = '2026-03-01T12:00:00Z',
        baziChart = computeBazi(birth, { now, yearsAround: 0 }),
        astroChart = computeAstrology(birth);
      const days = computeDailyRange(profile, '2026-03-01', '2026-03-31', tz, 'fixture');
      for (const day of days) {
        const chart = computeDaily({
          birth,
          baziChart,
          astroChart,
          vedicChart: null,
          date: { local: day.date, tz },
          seed: hashSeed(`fixture|${day.date}`),
        });
        expect(day.scores).toEqual(chart.scores);
        expect(day.overall).toBe(chart.scores.overall);
      }
    });
  }
  it('cold monthly batch meets the 400ms budget with unknown time and leap dates', () => {
    const start = performance.now();
    const days = computeDailyRange(
      { ...profile, timeUnknown: true },
      '2028-02-01',
      '2028-02-29',
      'America/New_York',
      'anon',
      'en',
    );
    expect(days).toHaveLength(29);
    expect(performance.now() - start).toBeLessThanOrEqual(400);
    expect(dailyRangeDates('2026-12-31', '2027-01-01', 'UTC')).toHaveLength(2);
    expect(dailyRangeDates('1900-01-01', '1900-01-01', 'UTC')).toHaveLength(1);
  });
  for (const [from, to, zone] of [
    ['2026-02-30', '2026-03-01', 'UTC'],
    ['2026-01-02', '2026-01-01', 'UTC'],
    ['2026-01-01', '2026-02-01', 'UTC'],
    ['1899-12-31', '1900-01-01', 'UTC'],
    ['2100-12-31', '2101-01-01', 'UTC'],
    ['2026-01-01', '2026-01-01', 'bad/zone'],
    ['2026-1-01', '2026-01-02', 'UTC'],
  ]) {
    it(`rejects invalid range ${from}/${to}/${zone}`, () =>
      expect(() => dailyRangeDates(from!, to!, zone!)).toThrow());
  }
});
describe('B-06 engine annual events', () => {
  const events = computeCalendarYear(profile, 2026, 'Asia/Shanghai');
  it('has every solar term exactly once and distinct Bazi/Ziwei year boundaries', () => {
    expect(
      events
        .filter((e) => e.kind === 'solar_term')
        .map((e) => e.detail)
        .sort(),
    ).toEqual(Object.values(SolarTerm).sort());
    expect(events.find((e) => e.kind === 'bazi_year')?.date).toBe('2026-02-04');
    expect(events.find((e) => e.kind === 'ziwei_year')?.date).toBe('2026-02-17');
    expect(events.filter((e) => e.kind === 'new_moon').length).toBeGreaterThanOrEqual(12);
    expect(events.filter((e) => e.kind === 'full_moon').length).toBeGreaterThanOrEqual(12);
    expect(events.filter((e) => e.kind === 'solar_eclipse').map((e) => e.date)).toEqual([
      '2026-02-17',
      '2026-08-13',
    ]);
    expect(events.filter((e) => e.kind === 'lunar_eclipse').map((e) => e.date)).toEqual([
      '2026-03-03',
      '2026-08-28',
    ]);
  });
  it('solar return is an actual natal longitude crossing', () => {
    const event = events.find((e) => e.kind === 'solar_return')!;
    const jd = Temporal.Instant.from(event.at).epochMilliseconds / 86400000 + 2440587.5;
    expect(computePositions(jd, ['sun']).sun.lon).toBeCloseTo(
      computePositions(birth.jd!, ['sun']).sun.lon,
      5,
    );
    expect(event.date).toMatch(/^2026-05-/);
  });
  it('stations bracket a negative-speed interval for each active retrograde', () => {
    for (const event of events.filter((e) => e.kind === 'retrograde')) {
      const body = event.detail as 'mercury' | 'venus' | 'mars';
      const from = Temporal.Instant.from(event.at).epochMilliseconds / 86400000 + 2440587.5;
      const to = Temporal.Instant.from(event.end!).epochMilliseconds / 86400000 + 2440587.5;
      expect(computePositions(from - 0.01, [body])[body].speed).toBeGreaterThan(0);
      expect(computePositions(from + 0.01, [body])[body].speed).toBeLessThan(0);
      expect(computePositions(to - 0.01, [body])[body].speed).toBeLessThan(0);
      expect(computePositions(to + 0.01, [body])[body].speed).toBeGreaterThan(0);
    }
  });
  it('retains intervals that overlap New Year and shows Mars retrograde', () => {
    const events = computeCalendarYear(profile, 2025, 'America/New_York');
    expect(
      events.some(
        (e) =>
          e.kind === 'retrograde' &&
          e.detail === 'mars' &&
          e.date.startsWith('2024') &&
          e.endDate?.startsWith('2025'),
      ),
    ).toBe(true);
  });
  it('computes personal luck, decade and Vedic transitions from the natal chart', () => {
    const collected = [2024, 2025, 2027, 2030, 2031, 2033, 2034].flatMap((year) =>
      computeCalendarYear(profile, year, 'Asia/Shanghai'),
    );
    for (const kind of ['bazi_luck', 'ziwei_decade', 'mahadasha', 'antardasha'])
      expect(
        collected.some((e) => e.kind === kind),
        kind,
      ).toBe(true);
  });
  it('unknown time omits Ziwei transitions and remains deterministic in both languages', () => {
    const a = computeCalendarYear({ ...profile, timeUnknown: true }, 2026, 'UTC', 'en');
    expect(a.some((e) => e.kind.startsWith('ziwei'))).toBe(false);
    expect(a.some((e) => e.kind === 'solar_return')).toBe(true);
    expect(a.some((e) => e.kind === 'antardasha')).toBe(false);
    expect(computeCalendarYear({ ...profile, timeUnknown: true }, 2026, 'UTC', 'zh')).toEqual(a);
  });
  it('every event title and explanation exists in all three catalogs', () => {
    for (const kind of [
      'solar_term',
      'bazi_year',
      'bazi_luck',
      'ziwei_year',
      'ziwei_decade',
      'retrograde',
      'new_moon',
      'full_moon',
      'solar_eclipse',
      'lunar_eclipse',
      'solar_return',
      'mahadasha',
      'antardasha',
    ]) {
      for (const catalog of [zh, en, tw])
        for (const prefix of ['event', 'explanation'])
          expect((catalog as Record<string, string>)[`calendar.${prefix}.${kind}`]).toBeTruthy();
    }
  });
  for (const year of [1899, 2101, 2026.5])
    it(`rejects unsupported year ${year}`, () =>
      expect(() => computeCalendarYear(profile, year, 'UTC')).toThrow());
  it('rejects invalid timezones', () =>
    expect(() => computeCalendarYear(profile, 2026, 'invalid')).toThrow());
});
