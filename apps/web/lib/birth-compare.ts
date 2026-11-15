import type { BirthInput } from '@tianji/shared';
/** Compare the inputs that change a natal chart; display-only place names are ignored. */
export function sameNatalBirth(a: BirthInput | null | undefined, b: BirthInput | null | undefined) {
  if (!a || !b) return false;
  const time = (value: BirthInput) => (value.timeUnknown ? null : [value.hour, value.minute]);
  const place = (value: BirthInput) =>
    value.place ? [value.place.lat, value.place.lng, value.place.tz] : null;
  return (
    a.calendar === b.calendar &&
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    Boolean(a.isLeapMonth) === Boolean(b.isLeapMonth) &&
    Boolean(a.timeUnknown) === Boolean(b.timeUnknown) &&
    JSON.stringify(time(a)) === JSON.stringify(time(b)) &&
    JSON.stringify(place(a)) === JSON.stringify(place(b)) &&
    a.gender === b.gender
  );
}
