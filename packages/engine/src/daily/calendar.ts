import { Temporal } from '@js-temporal/polyfill';
import * as Astronomy from 'astronomy-engine';
import { Lunar, Solar } from 'lunar-typescript';
import { z } from 'zod';
import { IanaTimezoneSchema, type BirthInput, type Locale } from '@tianji/shared';
import { normalizeBirth } from '../common/normalize-birth';
import { solarTerms } from '../common/divination';
import { EngineError } from '../common/error';
import { computeBazi } from '../bazi';
import { computeZiwei } from '../ziwei';
import { astroTime, computePositions } from '../astrology/ephemeris';
import { jdToISO, vimshottari } from '../astrology/dasha';
import { ayanamsaLahiri } from '../astrology/vedic-rules';
import { signed, wrap } from '../astrology/math';
// DESIGN-GAP: B-06 has no event schema; stable kind/detail keys carry data only, with explanations translated by next-intl in web.
export const CalendarEventSchema = z
  .object({
    kind: z.enum([
      'solar_term',
      'bazi_year',
      'bazi_luck',
      'ziwei_year',
      'ziwei_decade',
      'retrograde',
      'new_moon',
      'full_moon',
      'solar_eclipse',
      'lunar_eclipse',
      'solar_return',
      'mahadasha',
      'antardasha',
    ]),
    at: z.string().datetime(),
    date: z.string(),
    end: z.string().datetime().optional(),
    endDate: z.string().optional(),
    detail: z.string().optional(),
  })
  .strict();
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
/** Bisect a bracketed continuous astronomical boundary to sub-second precision, UT Julian days. */
function boundary(low: number, high: number, value: (jd: number) => number): number {
  const positive = value(low) >= 0;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (value(mid) >= 0 === positive) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
/** Compute annual astronomical and personal period events, filtered by the user's civil year. No IO or host timezone. */
export function computeCalendarYear(
  profile: BirthInput,
  year: number,
  tz: string,
  locale: Locale = 'zh',
): CalendarEvent[] {
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100 ||
    !IanaTimezoneSchema.safeParse(tz).success
  )
    throw new EngineError('E_INVALID_INPUT');
  const birth = normalizeBirth(profile, locale);
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 }).toZonedDateTime(tz),
    end = start.add({ years: 1 });
  const first = start.epochMilliseconds / 86400000 + 2440587.5,
    last = end.epochMilliseconds / 86400000 + 2440587.5;
  const events: CalendarEvent[] = [];
  const add = (kind: CalendarEvent['kind'], at: string, detail?: string, until?: string) => {
    const instant = Temporal.Instant.from(at),
      date = instant.toZonedDateTimeISO(tz).toPlainDate().toString();
    const stop = until ? Temporal.Instant.from(until) : undefined;
    if (
      instant.epochMilliseconds >= end.epochMilliseconds ||
      (stop
        ? stop.epochMilliseconds <= start.epochMilliseconds
        : instant.epochMilliseconds < start.epochMilliseconds)
    )
      return;
    events.push({
      kind,
      at: instant.toString(),
      date,
      ...(detail ? { detail } : {}),
      ...(stop
        ? { end: stop.toString(), endDate: stop.toZonedDateTimeISO(tz).toPlainDate().toString() }
        : {}),
    });
  };
  for (const term of solarTerms(year)) {
    add('solar_term', term.time.toInstant().toString(), term.name);
    if (term.name === 'li_chun') add('bazi_year', term.time.toInstant().toString());
  }
  const bazi = computeBazi(birth, { now: start.toInstant().toString(), yearsAround: 0 });
  const luckStart = Temporal.PlainDateTime.from(
    bazi.solarTimeAdjust.adjusted ?? bazi.solarTimeAdjust.original,
  )
    .add(bazi.luck.startAge)
    .toZonedDateTime(birth.local.tz);
  bazi.luck.periods.forEach((_, i) =>
    add(
      'bazi_luck',
      luckStart
        .add({ years: i * 10 })
        .toInstant()
        .toString(),
    ),
  );
  // DESIGN-GAP: Match existing iztro normal year/age division: Ziwei changes at lunar New Year in the birth timezone, unlike Bazi's exact Lichun instant.
  const clock = birth.solarTime.local ?? birth.local;
  const birthLunarYear = Solar.fromYmd(clock.year, clock.month, clock.day).getLunar().getYear();
  for (const y of [year - 1, year, year + 1]) {
    const solar = Lunar.fromYmd(y, 1, 1).getSolar();
    const newYear = Temporal.PlainDate.from({
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
    })
      .toZonedDateTime(birth.local.tz)
      .toInstant()
      .toString();
    if (!birth.timeUnknown && y >= birthLunarYear && y < birthLunarYear + 120) {
      add('ziwei_year', newYear);
      const chart = computeZiwei({ birth, now: newYear });
      if (chart.palaces.some((p) => p.decadal.fromYear === y)) add('ziwei_decade', newYear);
    }
  }
  for (const [angle, kind] of [
    [0, 'new_moon'],
    [180, 'full_moon'],
  ] as const) {
    let time = Astronomy.SearchMoonPhase(angle, astroTime(first), 40);
    while (time && time.ut + 2451545 < last) {
      add(kind, jdToISO(time.ut + 2451545));
      time = Astronomy.SearchMoonPhase(angle, time.AddDays(1), 40);
    }
  }
  // DESIGN-GAP: Eclipses are global peak instants, not claims of local visibility; explanations say this explicitly.
  let solar = Astronomy.SearchGlobalSolarEclipse(astroTime(first));
  while (solar.peak.ut + 2451545 < last) {
    add('solar_eclipse', jdToISO(solar.peak.ut + 2451545));
    solar = Astronomy.NextGlobalSolarEclipse(solar.peak);
  }
  let lunar = Astronomy.SearchLunarEclipse(astroTime(first));
  while (lunar.peak.ut + 2451545 < last) {
    add('lunar_eclipse', jdToISO(lunar.peak.ut + 2451545));
    lunar = Astronomy.NextLunarEclipse(lunar.peak);
  }
  // DESIGN-GAP: Scan daily to bracket stations, then bisect longitude speed; retain true endpoints for intervals overlapping the civil year.
  for (const body of ['mercury', 'venus', 'mars'] as const) {
    const speed = (jd: number) => computePositions(jd, [body])[body].speed;
    let begin: number | null = null,
      previous = speed(first - 400);
    for (let day = first - 399; day <= last + 400; day++) {
      const current = speed(day);
      if (previous < 0 !== current < 0) {
        const station = boundary(day - 1, day, speed);
        if (current < 0) begin = station;
        else if (begin !== null) {
          add('retrograde', jdToISO(begin), body, jdToISO(station));
          begin = null;
        }
      }
      previous = current;
    }
  }
  const natal = computePositions(birth.jd!, ['sun', 'moon']);
  const target = natal.sun.lon;
  let crossing = Astronomy.SearchSunLongitude(target, astroTime(first - 2), 370);
  while (crossing && crossing.ut + 2451545 < last + 2) {
    const approx = crossing.ut + 2451545;
    const returned = boundary(approx - 2, approx + 2, (jd) =>
      signed(computePositions(jd, ['sun']).sun.lon - target),
    );
    add('solar_return', jdToISO(returned));
    crossing = Astronomy.SearchSunLongitude(target, crossing.AddDays(2), 370);
  }
  const dasha = vimshottari(
    birth.jd!,
    wrap(natal.moon.lon - ayanamsaLahiri(birth.jd!)),
    first,
    !birth.timeUnknown,
  );
  for (const maha of dasha.sequence) {
    // Birth-clipped starts are not period changes.
    if (maha.from !== jdToISO(birth.jd!)) add('mahadasha', maha.from, maha.lord);
    for (const antar of maha.antar)
      if (antar.from !== jdToISO(birth.jd!)) add('antardasha', antar.from, antar.lord);
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind));
}
