import { LunarYear, LunarMonth } from 'lunar-typescript';
import { normalizeBirth, EngineError } from '@tianji/engine/common';
import type { BirthInput, Locale } from '@tianji/shared';
import { gregorianDayCount } from './birth-form-date';
export { gregorianDayCount };
/** Return real lunar months (negative means leap), with the exact number of days. */
export function lunarMonths(year: number) {
  return LunarYear.fromYear(year)
    .getMonths()
    .filter((m) => m.getYear() === year)
    .map((m) => ({ month: m.getMonth(), days: m.getDayCount() }));
}
/** Gregorian age uses the normalized solar birthday, including lunar conversions. */
export function isUnderThirteen(birth: BirthInput, locale: Locale, now = new Date()): boolean {
  // DESIGN-GAP: The exact age boundary uses the Gregorian birthday and UTC date; the client’s current timezone is not collected here.
  const { local } = normalizeBirth(birth, locale);
  const age =
    now.getUTCFullYear() -
    local.year -
    (now.getUTCMonth() + 1 < local.month ||
    (now.getUTCMonth() + 1 === local.month && now.getUTCDate() < local.day)
      ? 1
      : 0);
  return age < 13;
}
/** Validate calendar, IANA timezone and clock, returning a localization key without sensitive values. */
export function birthError(birth: BirthInput, locale: Locale): string | null {
  try {
    normalizeBirth(birth, locale);
    return null;
  } catch (e) {
    return e instanceof EngineError ? `engine.errors.${e.code}` : 'engine.errors.E_INVALID_INPUT';
  }
}
/** The 13 branches retain early/late Zi separately; representative hours are starts of their intervals. */
export const hourBranches = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
/** Lunar month day count, used to clamp the day when the selected month changes. */
export function lunarDayCount(year: number, month: number) {
  return LunarMonth.fromYm(year, month)?.getDayCount() ?? 30;
}
/** Days in the selected month of either calendar; lunar leap months use a negative month. */
export function monthDayCount(
  calendar: BirthInput['calendar'],
  year: number,
  month: number,
  isLeapMonth = false,
) {
  if (month < 1 || month > 12) return 31;
  if (calendar === 'gregorian') return gregorianDayCount(year, month);
  if (year < 1900 || year > 2100) return 30;
  return lunarDayCount(year, isLeapMonth ? -month : month);
}
/** Patch for a calendar switch: selecting the current calendar is a no-op, and the day is clamped to the target month's real length. */
export function switchCalendar(
  birth: BirthInput,
  calendar: BirthInput['calendar'],
): Partial<BirthInput> | null {
  if (birth.calendar === calendar) return null;
  const max = monthDayCount(calendar, birth.year, birth.month);
  return { calendar, isLeapMonth: false, day: birth.day ? Math.min(birth.day, max) : birth.day };
}
/** Patch for a year edit: a lunar leap month or day that no longer exists in the new year is corrected. */
export function yearPatch(birth: BirthInput, year: number): Partial<BirthInput> {
  const patch: Partial<BirthInput> = { year };
  if (birth.calendar !== 'lunar' || year < 1900 || year > 2100) return patch;
  if (birth.isLeapMonth && !lunarMonths(year).some((m) => m.month === -birth.month))
    patch.isLeapMonth = false;
  if (birth.month && birth.day)
    patch.day = Math.min(
      birth.day,
      monthDayCount('lunar', year, birth.month, patch.isLeapMonth ?? birth.isLeapMonth),
    );
  return patch;
}
