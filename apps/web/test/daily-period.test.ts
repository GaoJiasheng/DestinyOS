import { describe, expect, it } from 'vitest';
import type { DailyRangeDay } from '@tianji/engine/daily';
import { dayKeyword, monthBounds, periodStats, weekBounds } from '../lib/daily-period';

const day = (date: string, overall: number, scores: Partial<DailyRangeDay['scores']> = {}) =>
  ({
    date,
    overall,
    scores: { career: 60, wealth: 60, love: 60, health: 60, social: 60, overall, ...scores },
    drivers: { career: null, wealth: null, love: null, health: null, social: null },
  }) as DailyRangeDay;

describe('period helpers', () => {
  it('computes Monday-to-Sunday weeks and whole months', () => {
    expect(weekBounds('2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(weekBounds('2026-11-08')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(weekBounds('2026-12-31')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(monthBounds('2026-11-09')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('names the dimension that moved most and stays quiet on flat days', () => {
    expect(dayKeyword(day('2026-11-09', 60, { love: 78, career: 50 }))).toEqual({
      dim: 'love',
      dir: 'up',
    });
    expect(dayKeyword(day('2026-11-09', 60, { health: 40 }))).toEqual({
      dim: 'health',
      dir: 'down',
    });
    expect(dayKeyword(day('2026-11-09', 60, { career: 63 }))).toBeNull();
  });
  it('summarizes best, watch, counts and dimensional extremes', () => {
    const stats = periodStats([
      day('2026-11-09', 72, { career: 90, social: 40 }),
      day('2026-11-10', 48, { career: 80, social: 40 }),
      day('2026-11-11', 80),
      day('2026-11-12', 80),
    ]);
    expect(stats.best.date).toBe('2026-11-11');
    expect(stats.watch.date).toBe('2026-11-10');
    expect(stats.good).toBe(3);
    expect(stats.low).toBe(1);
    expect(stats.strong).toBe('career');
    expect(stats.weak).toBe('social');
    expect(stats.avg).toBe(70);
  });
});
