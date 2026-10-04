import { Temporal } from '@js-temporal/polyfill';
import { Lunar, LunarYear, Solar } from 'lunar-typescript';
import {
  BirthInputSchema,
  Locale,
  NormalizedBirthSchema,
  type NormalizedBirth,
  type EngineWarning,
} from '@tianji/shared';
import { EngineError } from './error';
import { apparentSolarTime } from './solar-time';
import { ganZhiAt } from './ganzhi';

/** Normalizes a birth (1900–2100) with IANA history; locale controls the no-place timezone default. */
export function normalizeBirth(raw: unknown, locale: Locale = 'zh'): NormalizedBirth {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'year' in raw &&
    typeof raw.year === 'number' &&
    Number.isInteger(raw.year) &&
    (raw.year < 1900 || raw.year > 2100)
  )
    throw new EngineError('E_DATE_OUT_OF_RANGE');
  const parsed = BirthInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new EngineError('E_INVALID_INPUT', undefined, {
      issues: parsed.error.issues.map(({ code, path }) => ({ code, path })),
    });
  if (locale !== 'zh' && locale !== 'en') throw new EngineError('E_INVALID_INPUT');
  const input = parsed.data;
  let { year, month, day } = input;
  if (input.calendar === 'lunar') {
    if (input.isLeapMonth && LunarYear.fromYear(year).getLeapMonth() !== month) {
      throw new EngineError('E_LUNAR_NO_LEAP_MONTH');
    }
    try {
      const solar = Lunar.fromYmd(year, input.isLeapMonth ? -month : month, day).getSolar();
      year = solar.getYear();
      month = solar.getMonth();
      day = solar.getDay();
    } catch {
      throw new EngineError('E_INVALID_INPUT');
    }
  }
  if (year < 1900 || year > 2100) throw new EngineError('E_DATE_OUT_OF_RANGE');
  // DESIGN-GAP: An incomplete clock is unknown, as §2.1 says a missing hour/minute denotes unknown time.
  const timeUnknown = input.timeUnknown || input.hour === undefined || input.minute === undefined;
  const tz = input.place?.tz ?? (locale === 'zh' ? 'Asia/Shanghai' : 'UTC');
  let time: Temporal.ZonedDateTime;
  try {
    if (/^[+-]/.test(tz)) throw new EngineError('E_INVALID_INPUT');
    // DESIGN-GAP: Temporal compatible picks the earlier overlap and shifts gaps forward; local reflects the resolved valid clock.
    time = Temporal.ZonedDateTime.from(
      {
        year,
        month,
        day,
        hour: timeUnknown ? 12 : input.hour,
        minute: timeUnknown ? 0 : input.minute,
        timeZone: tz,
      },
      { overflow: 'reject', disambiguation: 'compatible' },
    );
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  const warnings: EngineWarning[] = [];
  if (!input.place) warnings.push({ code: 'W_NO_PLACE', messageKey: 'engine.warnings.W_NO_PLACE' });
  // DESIGN-GAP: IANA has no DST flag in Temporal; use the minimum monthly-noon offset as the year's standard offset.
  const standardOffset = Math.min(
    ...Array.from(
      { length: 12 },
      (_, index) =>
        Temporal.ZonedDateTime.from({ year, month: index + 1, day: 1, hour: 12, timeZone: tz })
          .offsetNanoseconds,
    ),
  );
  if (time.offsetNanoseconds > standardOffset)
    warnings.push({ code: 'W_DST_PERIOD', messageKey: 'engine.warnings.W_DST_PERIOD' });
  const lunar = Solar.fromYmd(time.year, time.month, time.day).getLunar();
  const lng = input.place?.lng ?? null;
  const solarTime =
    lng !== null && !timeUnknown
      ? apparentSolarTime(time, lng)
      : {
          offsetMinutes: null,
          longitudeCorrectionMinutes: null,
          equationOfTimeMinutes: null,
          local: null,
        };
  return NormalizedBirthSchema.parse({
    local: {
      year: time.year,
      month: time.month,
      day: time.day,
      hour: timeUnknown ? null : time.hour,
      minute: timeUnknown ? null : time.minute,
      tz,
    },
    utc: time.toInstant().toString({ smallestUnit: 'second' }),
    jd: time.epochMilliseconds / 86_400_000 + 2440587.5,
    timeUnknown,
    place: {
      lat: input.place?.lat ?? null,
      lng,
      tz,
      ...(input.place ? { name: input.place.name } : {}),
    },
    gender: input.gender,
    solarTime: { enabled: lng !== null, ...solarTime },
    lunar: {
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      isLeap: lunar.getMonth() < 0,
      day: lunar.getDay(),
      yearGanZhi: ganZhiAt(lunar.getYear() - 4),
    },
    warnings,
  });
}
