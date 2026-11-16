import { LunarYear } from 'lunar-typescript';
import { IanaTimezoneSchema, type BirthInput } from '@tianji/shared';
import { lunarDayCount } from './birth-form';
import {
  birthFields,
  dateIssues as baseDateIssues,
  type BirthField,
  type FieldIssue,
} from './birth-form-date';
export { birthFields, type BirthField, type FieldIssue } from './birth-form-date';
const lunar = {
  leapMonth: (year: number) => LunarYear.fromYear(year).getLeapMonth(),
  days: (year: number, month: number, leap: boolean) => lunarDayCount(year, leap ? -month : month),
};
/** Date problems for either calendar. */
export function dateIssues(birth: BirthInput): FieldIssue[] {
  return baseDateIssues(birth, lunar);
}
/** Step one requires a full date and either a chosen hour/clock or the explicit unknown-time box. */
export function stepOneIssues(birth: BirthInput, precise: boolean): FieldIssue[] {
  const issues = dateIssues(birth);
  if (!birth.timeUnknown && (birth.hour === undefined || birth.minute === undefined))
    issues.push({
      field: 'hour',
      key: precise ? 'form.birth.error.timeRequired' : 'form.birth.error.hourRequired',
    });
  return issues;
}
/** Step two checks the place: unconfirmed city text and an invalid manual IANA zone. */
export function stepTwoIssues(birth: BirthInput, cityPending: boolean): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (cityPending) issues.push({ field: 'city', key: 'form.birth.city.unselected' });
  if (birth.place && !IanaTimezoneSchema.safeParse(birth.place.tz).success)
    issues.push({ field: 'tz', key: 'form.birth.error.tz' });
  return issues;
}
/** DOM ids for every birth field, derived from one React id. */
export const fieldIds = (base: string) =>
  Object.fromEntries(birthFields.map((f) => [f, `${base}-${f}`])) as Record<BirthField, string>;
