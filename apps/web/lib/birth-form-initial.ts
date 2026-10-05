import type { BirthInput } from '@tianji/shared';
/** Copy editable birth fields from a profile, or return the existing empty form defaults.
 * @param initial Optional birth snapshot; display metadata is intentionally not copied into birth fields.
 */
export function initialBirth(initial?: BirthInput): BirthInput {
  if (initial) {
    const { calendar, year, month, day, isLeapMonth, hour, minute, timeUnknown, place, gender } =
      initial;
    return {
      calendar,
      year,
      month,
      day,
      isLeapMonth,
      hour,
      minute,
      timeUnknown,
      place,
      gender,
      timeSource: initial.timeSource,
      rectificationConfidence: initial.rectificationConfidence,
    };
  }
  return {
    calendar: 'gregorian',
    year: 0,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    timeUnknown: false,
    gender: 'unspecified',
  };
}
