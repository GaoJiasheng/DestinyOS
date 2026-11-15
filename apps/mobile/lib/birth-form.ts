import { LunarMonth, LunarYear } from 'lunar-typescript';
import { normalizeBirth, EngineError } from '@tianji/engine/common';
import { BirthInputSchema, IanaTimezoneSchema, type BirthInput, type Locale } from '@tianji/shared';
import type { MessageKey } from './i18n';
export const hourBranches = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] as const;
/** Real lunar months; negative month numbers identify leap months, never arbitrary toggles. */
export function lunarMonths(year: number) {
  return LunarYear.fromYear(year)
    .getMonths()
    .filter((month) => month.getYear() === year)
    .map((month) => ({ month: month.getMonth(), days: month.getDayCount() }));
}
/** Clamp date wheels to actual month lengths, including lunar leap months. */
export function monthDays(birth: BirthInput): number {
  if (birth.calendar === 'lunar') {
    if (birth.year < 1900 || birth.year > 2100 || !birth.month) return 30;
    return (
      LunarMonth.fromYm(
        birth.year,
        birth.isLeapMonth ? -birth.month : birth.month,
      )?.getDayCount() ?? 30
    );
  }
  // An unknown year still allows 29 February until the year is entered.
  if (birth.month === 2 && (birth.year < 1900 || birth.year > 2100)) return 29;
  const leap = birth.year % 4 === 0 && (birth.year % 100 !== 0 || birth.year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][birth.month - 1] ?? 31;
}
/** Surface only localized error codes, without logging birth facts or exceptions. */
export function validateBirth(raw: unknown, locale: Locale): MessageKey | null {
  try {
    normalizeBirth(BirthInputSchema.parse(raw), locale);
    return null;
  } catch (error) {
    const key =
      error instanceof EngineError
        ? `engine.errors.${error.code}`
        : 'engine.errors.E_INVALID_INPUT';
    return key as MessageKey;
  }
}
/** Match Web's neutral COPPA check using Gregorian birthday and a UTC boundary. */
export function underThirteen(birth: BirthInput, locale: Locale, today = new Date()): boolean {
  const { local } = normalizeBirth(birth, locale);
  return (
    today.getUTCFullYear() -
      local.year -
      Number(
        today.getUTCMonth() + 1 < local.month ||
          (today.getUTCMonth() + 1 === local.month && today.getUTCDate() < local.day),
      ) <
    13
  );
}
/** A blank new-profile form: date and hour stay unset (0 / undefined) until explicitly chosen. */
export function emptyBirth(): BirthInput {
  return {
    calendar: 'gregorian',
    year: 0,
    month: 0,
    day: 0,
    hour: undefined,
    minute: undefined,
    timeUnknown: false,
    gender: 'unspecified',
  };
}
/** Fields that can carry an inline error, in on-screen order. */
export const birthFields = ['year', 'month', 'day', 'hour', 'city', 'tz'] as const;
export type BirthField = (typeof birthFields)[number];
export type FieldIssue = {
  field: BirthField;
  key: MessageKey;
  params?: Record<string, string | number>;
};
const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
/** Date problems with a specific reason, mirroring Web's birth-form-date rules. */
export function dateIssues(birth: BirthInput): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const yearOk = inRange(birth.year, 1900, 2100);
  if (!birth.year) issues.push({ field: 'year', key: 'form.birth.error.yearRequired' });
  else if (!yearOk) issues.push({ field: 'year', key: 'engine.errors.E_DATE_OUT_OF_RANGE' });
  if (!birth.month) issues.push({ field: 'month', key: 'form.birth.error.monthRequired' });
  else if (
    birth.calendar === 'lunar' &&
    birth.isLeapMonth &&
    yearOk &&
    !lunarMonths(birth.year).some((month) => month.month === -birth.month)
  )
    issues.push({ field: 'month', key: 'engine.errors.E_LUNAR_NO_LEAP_MONTH' });
  if (!birth.day) issues.push({ field: 'day', key: 'form.birth.error.dayRequired' });
  else if (birth.month && (birth.calendar === 'gregorian' || yearOk)) {
    const days = monthDays(birth);
    if (birth.day > days)
      issues.push(
        birth.calendar === 'lunar'
          ? { field: 'day', key: 'form.birth.error.lunarDays', params: { days } }
          : birth.month === 2 && birth.day === 29
            ? {
                field: 'day',
                key: 'form.birth.error.notLeap',
                params: { year: String(birth.year) },
              }
            : {
                field: 'day',
                key: 'form.birth.error.noSuchDay',
                params: { month: birth.month, day: birth.day },
              },
      );
  }
  return issues;
}
/** Step one needs a full date and either a chosen hour or the explicit unknown-time switch. */
export function stepOneIssues(birth: BirthInput, precise: boolean): FieldIssue[] {
  const issues = dateIssues(birth);
  if (!birth.timeUnknown && birth.hour === undefined)
    issues.push({
      field: 'hour',
      key: precise ? 'form.birth.error.timeRequired' : 'form.birth.error.hourRequired',
    });
  return issues;
}
/** Step two: typed-but-unchosen city text, and an invalid manual IANA zone. */
export function stepTwoIssues(birth: BirthInput, cityPending: boolean): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (cityPending) issues.push({ field: 'city', key: 'form.birth.city.unselected' });
  if (birth.place && !IanaTimezoneSchema.safeParse(birth.place.tz).success)
    issues.push({ field: 'tz', key: 'form.birth.error.tz' });
  return issues;
}
/** The device zone for manual coordinates, falling back to UTC when Intl cannot resolve one. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && IanaTimezoneSchema.safeParse(zone).success ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
}
