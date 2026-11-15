import type { BirthInput } from '@tianji/shared';
/** Copy editable birth fields from a profile, or return an empty form.
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
    // Empty date and hour (0 / undefined) so nothing looks pre-filled; the form requires an explicit choice.
    year: 0,
    month: 0,
    day: 0,
    hour: undefined,
    minute: undefined,
    timeUnknown: false,
    gender: 'unspecified',
  };
}
