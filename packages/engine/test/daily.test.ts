import { Temporal } from '@js-temporal/polyfill';
import { DailyChartSchema } from '@tianji/shared';
import { Solar } from 'lunar-typescript';
import { describe, expect, it } from 'vitest';
import {
  compute,
  computeAstrology,
  computeBazi,
  computeDaily,
  computeVedic,
  dailyDateAt,
  hashSeed,
  normalizeBirth,
} from '../src';
import { birth, daily, input, natal, now } from './daily-fixtures';
import A from './fixtures/birth/A.json';
import E from './fixtures/birth/E.json';
import golden from './fixtures/daily/A.json';

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
