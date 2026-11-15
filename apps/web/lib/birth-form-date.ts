import type { BirthInput } from '@tianji/shared';
// Calendar-free on purpose: the date-only numerology form must not pull lunar tables into its bundle.
/** Lunar lookups supplied by callers that support the lunar calendar. */
export type LunarInfo = {
  leapMonth: (year: number) => number;
  days: (year: number, month: number, leap: boolean) => number;
};
/** Gregorian month length; an unknown or out-of-range year allows 29 February until the year is known. */
export function gregorianDayCount(year: number, month: number) {
  if (month === 2) {
    if (year < 1900 || year > 2100) return 29;
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}
/** Fields that can carry an inline error; the order is the focus order after a failed submit. */
export const birthFields = ['year', 'month', 'day', 'hour', 'city', 'tz'] as const;
export type BirthField = (typeof birthFields)[number];
export type FieldIssue = {
  field: BirthField;
  key: string;
  params?: Record<string, string | number>;
};
const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
/** Date problems with a specific, user-facing reason; an empty field is 0 in form state. */
export function dateIssues(birth: BirthInput, lunar?: LunarInfo): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const yearOk = inRange(birth.year, 1900, 2100);
  if (!birth.year) issues.push({ field: 'year', key: 'form.birth.error.yearRequired' });
  else if (!yearOk) issues.push({ field: 'year', key: 'engine.errors.E_DATE_OUT_OF_RANGE' });
  const monthOk = inRange(birth.month, 1, 12);
  if (!birth.month) issues.push({ field: 'month', key: 'form.birth.error.monthRequired' });
  else if (!monthOk) issues.push({ field: 'month', key: 'form.birth.error.monthRange' });
  else if (
    birth.calendar === 'lunar' &&
    birth.isLeapMonth &&
    yearOk &&
    lunar &&
    lunar.leapMonth(birth.year) !== birth.month
  )
    issues.push({ field: 'month', key: 'engine.errors.E_LUNAR_NO_LEAP_MONTH' });
  if (!birth.day) issues.push({ field: 'day', key: 'form.birth.error.dayRequired' });
  else if (!inRange(birth.day, 1, 31))
    issues.push({ field: 'day', key: 'form.birth.error.dayRange' });
  else if (monthOk && (birth.calendar === 'gregorian' || (yearOk && lunar))) {
    const days =
      birth.calendar === 'gregorian'
        ? gregorianDayCount(birth.year, birth.month)
        : lunar!.days(birth.year, birth.month, Boolean(birth.isLeapMonth));
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
