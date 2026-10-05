import { Temporal } from '@js-temporal/polyfill';
import { BaziChartSchema, type BaziChart, type NormalizedBirth } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { compute, computeBazi, EngineError, normalizeBirth } from '../src';
import { now } from './bazi-fixtures';
import A from './fixtures/bazi/A.json';
import E from './fixtures/bazi/E.json';

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
