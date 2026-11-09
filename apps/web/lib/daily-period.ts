import { Temporal } from '@js-temporal/polyfill';
import { DIMENSIONS, dailyStars, type Dimension } from '@tianji/engine/daily';
import type { DailyRangeDay } from '@tianji/engine/daily';

export type PeriodKind = 'week' | 'month';
/** Inclusive Monday-to-Sunday bounds of the civil week containing `date`. */
export function weekBounds(date: string): { from: string; to: string } {
  const day = Temporal.PlainDate.from(date);
  const from = day.subtract({ days: day.dayOfWeek - 1 });
  return { from: from.toString(), to: from.add({ days: 6 }).toString() };
}
/** Inclusive first-to-last-day bounds of the civil month containing `date`. */
export function monthBounds(date: string): { from: string; to: string } {
  const start = Temporal.PlainDate.from(date).with({ day: 1 });
  return {
    from: start.toString(),
    to: start.with({ day: start.daysInMonth }).toString(),
  };
}
/** The dimension that moved furthest from the 60-point base, or null on a flat day. */
export function dayKeyword(day: DailyRangeDay): { dim: Dimension; dir: 'up' | 'down' } | null {
  let dim: Dimension = DIMENSIONS[0];
  for (const candidate of DIMENSIONS)
    if (Math.abs(day.scores[candidate] - 60) > Math.abs(day.scores[dim] - 60)) dim = candidate;
  const move = day.scores[dim] - 60;
  return Math.abs(move) < 5 ? null : { dim, dir: move > 0 ? 'up' : 'down' };
}
/** Period-level statistics; best/watch break ties toward the earlier date. */
export function periodStats(days: DailyRangeDay[]) {
  const best = days.reduce((a, b) => (b.overall > a.overall ? b : a));
  const watch = days.reduce((a, b) => (b.overall < a.overall ? b : a));
  const average = (dim: Dimension) => days.reduce((sum, d) => sum + d.scores[dim], 0) / days.length;
  const ranked = [...DIMENSIONS].sort((a, b) => average(b) - average(a));
  return {
    best,
    watch,
    avg: Math.round(days.reduce((sum, d) => sum + d.overall, 0) / days.length),
    good: days.filter((d) => dailyStars(d.overall) >= 4).length,
    low: days.filter((d) => dailyStars(d.overall) <= 2).length,
    strong: ranked[0]!,
    weak: ranked[ranked.length - 1]!,
  };
}
/** Five gold shades, one per star level, matching the full calendar view. */
export const heatColors = ['#3d301d', '#69502a', '#997139', '#c69b52', '#f0cf80'];
