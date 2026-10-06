import { LunarMonth, LunarYear } from 'lunar-typescript';
import { normalizeBirth, EngineError } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput, type Locale } from '@tianji/shared';
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
  if (birth.calendar === 'lunar')
    return (
      LunarMonth.fromYm(
        birth.year,
        birth.isLeapMonth ? -birth.month : birth.month,
      )?.getDayCount() ?? 30
    );
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
