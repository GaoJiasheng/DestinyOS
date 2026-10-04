import { Temporal } from '@js-temporal/polyfill';
import { calculateTrueSolarTime } from '@openfate/true-solar-time';

/** NOAA fractional-year equation of time; UTC input, output in minutes. */
export function noaaEquationOfTime(utc: Temporal.PlainDateTime): number {
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  const gamma =
    ((2 * Math.PI) / utc.daysInYear) * (utc.dayOfYear - 1 + (utc.hour + utc.minute / 60 - 12) / 24);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  );
}
/** NOAA solar-clock correction in minutes; longitude is east-positive degrees. */
export function noaaSolarOffset(time: Temporal.ZonedDateTime, longitude: number): number {
  return (
    longitude * 4 -
    time.offsetNanoseconds / 60e9 +
    noaaEquationOfTime(time.withTimeZone('UTC').toPlainDateTime())
  );
}
/** Computes apparent solar time without host-local timezone arithmetic; accepts a resolved IANA instant. */
export function apparentSolarTime(time: Temporal.ZonedDateTime, longitude: number) {
  const longitudeCorrectionMinutes = longitude * 4 - time.offsetNanoseconds / 60e9;
  let equationOfTimeMinutes: number;
  try {
    // Use Temporal's resolved offset to avoid the upstream 1,681-step IANA scan, DST ambiguity and date-line wrapping.
    equationOfTimeMinutes = calculateTrueSolarTime(
      {
        year: time.year,
        month: time.month,
        day: time.day,
        hour: time.hour,
        minute: time.minute,
        timeZoneOffset: time.offsetNanoseconds / 36e11,
      },
      { longitude, algorithm: 'meeus' },
    ).equationOfTimeMinutes;
    if (!Number.isFinite(equationOfTimeMinutes)) throw new RangeError('E_EPHEMERIS');
  } catch {
    equationOfTimeMinutes = noaaEquationOfTime(time.withTimeZone('UTC').toPlainDateTime());
  }
  const offsetMinutes = longitudeCorrectionMinutes + equationOfTimeMinutes;
  // DESIGN-GAP: Preserve fractional correction minutes, truncate corrected civil clock to the containing minute.
  const adjusted = time.toPlainDateTime().add({ milliseconds: Math.round(offsetMinutes * 60_000) });
  return {
    offsetMinutes,
    longitudeCorrectionMinutes,
    equationOfTimeMinutes,
    local: {
      year: adjusted.year,
      month: adjusted.month,
      day: adjusted.day,
      hour: adjusted.hour,
      minute: adjusted.minute,
    },
  };
}
