import { LunarYear, LunarMonth } from 'lunar-typescript';
import { normalizeBirth, EngineError } from '@tianji/engine/common';
import type { BirthInput, Locale } from '@tianji/shared';
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
