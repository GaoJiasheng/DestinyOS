import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import { z } from 'zod';
import { SolarTerm, type Element, type Verdict } from '@tianji/shared';
import { EngineError } from './error';
import { STEMS, BRANCHES, ELEMENTS, mod, ganZhiAt, ganZhiIndex } from './ganzhi';
export const ZonedTimeSchema = z.union([z.string(), z.instanceof(Temporal.ZonedDateTime)]);
export type ZonedTime = z.infer<typeof ZonedTimeSchema>;
/** Resolves explicit IANA zoned ISO time; rejects host timezone defaults and years outside 1900–2100. */
export function zonedTime(raw: ZonedTime): Temporal.ZonedDateTime {
  let time: Temporal.ZonedDateTime;
  try {
    time = Temporal.ZonedDateTime.from(raw);
    if (/^[+-]/.test(time.timeZoneId)) throw new EngineError('E_INVALID_INPUT');
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  if (time.year < 1900 || time.year > 2100) throw new EngineError('E_DATE_OUT_OF_RANGE');
  return time;
}
/** Validates an engine boundary and emits only stable translated error codes. */
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new EngineError('E_INVALID_INPUT');
  return parsed.data;
}
/** Civil clock lunar conversion and exact four pillars; zi_unified changes the day at 23:00. */
export function calendarAt(time: Temporal.ZonedDateTime, clock = time.toPlainDateTime()) {
  const lunar = Solar.fromYmdHms(
    clock.year,
    clock.month,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  ).getLunar();
  // Year/month term boundaries are astronomical instants; lunar-typescript's ephemeris clock is UTC+8.
  const ephemerisClock = time.withTimeZone('+08:00');
  const ephemeris = Solar.fromYmdHms(
    ephemerisClock.year,
    ephemerisClock.month,
    ephemerisClock.day,
    ephemerisClock.hour,
    ephemerisClock.minute,
    ephemerisClock.second,
  ).getLunar();
  // DESIGN-GAP: lunar-typescript's Exact (sect 1), not Exact2, implements the normative 23:00 change; 04's sect mapping is reversed.
  const day = {
    stem: STEMS[lunar.getDayGanIndexExact()]!,
    branch: BRANCHES[lunar.getDayZhiIndexExact()]!,
  };
  return {
    lunar: {
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      isLeap: lunar.getMonth() < 0,
    },
    pillars: {
      year: {
        stem: STEMS[ephemeris.getYearGanIndexExact()]!,
        branch: BRANCHES[ephemeris.getYearZhiIndexExact()]!,
      },
      month: {
        stem: STEMS[ephemeris.getMonthGanIndexExact()]!,
        branch: BRANCHES[ephemeris.getMonthZhiIndexExact()]!,
      },
      day,
      hour: { stem: STEMS[lunar.getTimeGanIndex()]!, branch: BRANCHES[lunar.getTimeZhiIndex()]! },
    },
    fuTou: ganZhiAt(ganZhiIndex(day.stem, day.branch) - (ganZhiIndex(day.stem, day.branch) % 5)),
  };
}
const TERM_NAMES = [
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
  '小寒',
  '大寒',
];
/** Astronomical solar terms, library CST converted to instants, independent of caller timezone. */
export function solarTerms(year: number) {
  const terms: { name: SolarTerm; time: Temporal.ZonedDateTime }[] = [];
  for (const y of [year - 1, year, year + 1]) {
    const table = Solar.fromYmd(y, 6, 1).getLunar().getJieQiTable();
    for (const [i, name] of TERM_NAMES.entries()) {
      const solar = table[name];
      if (solar) {
        const time = Temporal.ZonedDateTime.from({
          year: solar.getYear(),
          month: solar.getMonth(),
          day: solar.getDay(),
          hour: solar.getHour(),
          minute: solar.getMinute(),
          second: solar.getSecond(),
          timeZone: '+08:00',
        }).withTimeZone('Asia/Shanghai');
        if (!terms.some((t) => t.time.epochNanoseconds === time.epochNanoseconds))
          terms.push({ name: Object.values(SolarTerm)[i]!, time });
      }
    }
  }
  return terms.sort((a, b) => Temporal.ZonedDateTime.compare(a.time, b.time));
}
/** Current solar term at an exact instant, plus its next term. */
export function solarTermAt(time: Temporal.ZonedDateTime) {
  const terms = solarTerms(time.year);
  let i = terms.length - 1;
  while (i >= 0 && Temporal.ZonedDateTime.compare(terms[i]!.time, time) > 0) i--;
  return { current: terms[i]!, next: terms[i + 1]! };
}
/** Five-element delta in generating order: same 0, generates 1, controls 2, controlled 3, generated 4. */
export function elementDelta(a: Element, b: Element): number {
  return mod(ELEMENTS.indexOf(b) - ELEMENTS.indexOf(a), 5);
}
/** Stable five-level verdict thresholds, score 0–100. */
export function verdictFor(score: number): Verdict {
  return score >= 80
    ? 'auspicious'
    : score >= 60
      ? 'favorable'
      : score >= 40
        ? 'neutral'
        : score >= 20
          ? 'unfavorable'
          : 'inauspicious';
}
// DESIGN-GAP: Documented qualitative weights map linearly around neutral 50, clamped to [0,100].
/** Clamp a computed score to the documented range. */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
