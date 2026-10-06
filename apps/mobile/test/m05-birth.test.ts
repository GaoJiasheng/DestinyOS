import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput } from '@tianji/shared';
import {
  hourBranches,
  lunarMonths,
  monthDays,
  underThirteen,
  validateBirth,
} from '../lib/birth-form';
import { ProfileSchema, SettingsSchema } from '../lib/data/models';
const birth: BirthInput = {
  calendar: 'gregorian',
  year: 1988,
  month: 7,
  day: 10,
  hour: 14,
  minute: 0,
  timeUnknown: false,
  gender: 'female',
  place: { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
};
it('retains thirteen distinct early/late Zi entries, and all minute boundaries', () => {
  expect(hourBranches).toEqual([0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]);
  expect(validateBirth({ ...birth, hour: 23, minute: 59 }, 'en')).toBeNull();
  expect(validateBirth({ ...birth, minute: 60 }, 'en')).toBe('engine.errors.E_INVALID_INPUT');
});
it('validates fixture F leap month and clamps the real lunar date wheel', () => {
  expect(lunarMonths(1993).some((month) => month.month === -3)).toBe(true);
  expect(lunarMonths(1994).some((month) => month.month === -3)).toBe(false);
  const lunar: BirthInput = {
    ...birth,
    calendar: 'lunar',
    year: 1993,
    month: 3,
    day: 15,
    isLeapMonth: true,
    hour: 6,
  };
  expect(validateBirth(lunar, 'zh')).toBeNull();
  expect(monthDays(lunar)).toBe(29);
  expect(validateBirth({ ...lunar, year: 1994 }, 'zh')).toBe('engine.errors.E_LUNAR_NO_LEAP_MONTH');
  expect(monthDays({ ...birth, year: 2000, month: 2 })).toBe(29);
  expect(monthDays({ ...birth, year: 1900, month: 2 })).toBe(28);
});
it('preserves shared historical DST guidance and rejects invalid IANA/manual coordinates', () => {
  expect(normalizeBirth(birth).warnings.some((warning) => warning.code === 'W_DST_PERIOD')).toBe(
    true,
  );
  expect(validateBirth({ ...birth, place: { ...birth.place!, tz: 'Invalid/Zone' } }, 'en')).toBe(
    'engine.errors.E_INVALID_INPUT',
  );
  expect(validateBirth({ ...birth, place: { ...birth.place!, lat: NaN } }, 'en')).toBe(
    'engine.errors.E_INVALID_INPUT',
  );
});
it('clears stale clocks for unknown time and keeps native defaults compatible with old encrypted records', () => {
  const input = BirthInputSchema.parse({ ...birth, timeUnknown: true, hour: 99, minute: null });
  expect(input.hour).toBeUndefined();
  expect(input.minute).toBeUndefined();
  expect(SettingsSchema.parse({}).dailyPushEnabled).toBe(true);
  expect(SettingsSchema.parse({}).dailyPushTime).toBe('08:00');
  expect(
    ProfileSchema.parse({ name: '', birth: input, version: 1, isCurrent: true }).options,
  ).toBeUndefined();
});
it('checks the exact 13th birthday and converts lunar birth dates before age checking', () => {
  const now = new Date('2026-10-07T00:00:00Z');
  expect(underThirteen({ ...birth, year: 2013, month: 10, day: 7 }, 'en', now)).toBe(false);
  expect(underThirteen({ ...birth, year: 2013, month: 10, day: 8 }, 'en', now)).toBe(true);
  expect(
    underThirteen({ ...birth, calendar: 'lunar', year: 2013, month: 10, day: 7 }, 'en', now),
  ).toBe(true);
});
