import { Temporal } from '@js-temporal/polyfill';
import { Nakshatra, PanchangSchema, type Panchang } from '@tianji/shared';
import { EngineError } from '../common/error';
import { computeLongitudes, sunriseSunset } from './ephemeris';
import { ayanamsaLahiri } from './vedic-rules';
import { jdToISO } from './dasha';
import { wrap, signed } from './math';
export const TITHI_KEYS = [
  'pratipada',
  'dvitiya',
  'tritiya',
  'chaturthi',
  'panchami',
  'shashthi',
  'saptami',
  'ashtami',
  'navami',
  'dashami',
  'ekadashi',
  'dvadashi',
  'trayodashi',
  'chaturdashi',
  'purnima',
] as const;
export const YOGA_KEYS = [
  'vishkambha',
  'priti',
  'ayushman',
  'saubhagya',
  'shobhana',
  'atiganda',
  'sukarma',
  'dhriti',
  'shula',
  'ganda',
  'vriddhi',
  'dhruva',
  'vyaghata',
  'harshana',
  'vajra',
  'siddhi',
  'vyatipata',
  'variyana',
  'parigha',
  'shiva',
  'siddha',
  'sadhya',
  'shubha',
  'shukla',
  'brahma',
  'indra',
  'vaidhriti',
] as const;
export const VARA_KEYS = [
  'raviwara',
  'somawara',
  'mangalawara',
  'budhawara',
  'guruwara',
  'shukrawara',
  'shaniwara',
] as const;
/** Karana name for the 0-based half-tithi (0..59); fixed four at the cycle ends. */
export function karanaKey(index: number): string {
  if (index === 0) return 'kimstughna';
  if (index >= 57) return ['shakuni', 'chatushpada', 'naga'][index - 57]!;
  return ['bava', 'balava', 'kaulava', 'taitila', 'garaja', 'vanija', 'vishti'][(index - 1) % 7]!;
}
type Limb = 'tithi' | 'nakshatra' | 'yoga' | 'karana';
const widths: Record<Limb, number> = { tithi: 12, nakshatra: 40 / 3, yoga: 40 / 3, karana: 6 };
/** Five-limb Panchang at local sunrise, with UTC ending instants and all transitions up to the following sunrise. */
export function computePanchang(
  date: string,
  place: { lat: number; lng: number; tz: string },
  atJD?: number,
): Panchang {
  let day: Temporal.ZonedDateTime;
  try {
    day = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: place.tz, plainTime: '00:00' });
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  const dayJD = day.epochMilliseconds / 86400000 + 2440587.5,
    solar = sunriseSunset(dayJD, place.lat, place.lng),
    nextDay = day.add({ days: 1 }),
    nextSolar = sunriseSunset(
      nextDay.epochMilliseconds / 86400000 + 2440587.5,
      place.lat,
      place.lng,
    );
  if (atJD !== undefined && atJD < (solar.sunrise ?? dayJD))
    return computePanchang(day.subtract({ days: 1 }).toPlainDate().toString(), place, atJD);
  // DESIGN-GAP: Optional birth instant samples the active sunrise-based day; before sunrise belongs to the previous Vara.
  // DESIGN-GAP: Polar no-sunrise Panchang uses local midnight as its day boundary and exposes sunrise=null.
  const start = atJD ?? solar.sunrise ?? dayJD,
    end = nextSolar.sunrise ?? nextDay.epochMilliseconds / 86400000 + 2440587.5;
  // DESIGN-GAP: Share identical bisection samples across the four limbs within this call only; no persistent chart/result cache.
  const samples = new Map<number, Record<Limb, number>>();
  const angles = (jd: number): Record<Limb, number> => {
    const prior = samples.get(jd);
    if (prior) return prior;
    // DESIGN-GAP: Panchang bisection uses only angles; avoid the two velocity samples per body, preserving the same position evaluation.
    const p = computeLongitudes(jd, ['sun', 'moon']),
      a = ayanamsaLahiri(jd);
    const result = {
      tithi: wrap(p.moon - p.sun),
      karana: wrap(p.moon - p.sun),
      nakshatra: wrap(p.moon - a),
      yoga: wrap(p.sun + p.moon - 2 * a),
    };
    samples.set(jd, result);
    return result;
  };
  const key = (limb: Limb, index: number): string =>
    limb === 'nakshatra'
      ? Nakshatra[index]!
      : limb === 'yoga'
        ? YOGA_KEYS[index]!
        : limb === 'karana'
          ? karanaKey(index)
          : index === 29
            ? 'amavasya'
            : TITHI_KEYS[index % 15]!;
  const finish = (jd: number, limb: Limb): number => {
    const angle = angles(jd)[limb],
      width = widths[limb],
      remaining = width - (angle % width);
    const delta = (time: number) => signed(angles(time)[limb] - angle) - remaining;
    let low = jd,
      high = jd + 0.25;
    while (delta(high) < 0 && high < jd + 5) high += 0.25;
    if (delta(high) < 0) throw new EngineError('E_EPHEMERIS');
    for (let i = 0; i < 32; i++) {
      const mid = (low + high) / 2;
      if (delta(mid) < 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };
  const initial = angles(start),
    transitions: Panchang['transitions'] = [];
  const limbValue = (limb: Limb) => {
    const index = Math.floor(initial[limb] / widths[limb]),
      ends = finish(start, limb);
    let change = ends;
    while (change < end) {
      const sample = change + 1 / 86400,
        newIndex = Math.floor(angles(sample)[limb] / widths[limb]),
        next = finish(sample, limb);
      transitions.push({
        limb,
        index: limb === 'tithi' ? newIndex + 1 : newIndex,
        key: key(limb, newIndex),
        startsAt: jdToISO(change),
        endsAt: jdToISO(next),
      });
      change = next;
    }
    return {
      index: limb === 'tithi' ? index + 1 : index,
      key: key(limb, index),
      endsAt: jdToISO(ends),
    };
  };
  return PanchangSchema.parse({
    date,
    tz: place.tz,
    sunrise: solar.sunrise === null ? null : jdToISO(solar.sunrise),
    sunset: solar.sunset === null ? null : jdToISO(solar.sunset),
    tithi: limbValue('tithi'),
    nakshatra: limbValue('nakshatra'),
    yoga: limbValue('yoga'),
    karana: limbValue('karana'),
    vara: { index: day.dayOfWeek % 7, key: VARA_KEYS[day.dayOfWeek % 7]!, endsAt: jdToISO(end) },
    transitions: transitions.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  });
}
