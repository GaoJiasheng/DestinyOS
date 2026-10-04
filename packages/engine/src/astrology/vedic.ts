import { Temporal } from '@js-temporal/polyfill';
import {
  Graha,
  VedicChartSchema,
  type VedicChart,
  type NormalizedBirth,
  type Planet,
} from '@tianji/shared';
import { EngineError } from '../common/error';
import { computePositions } from './ephemeris';
import { computeAngles } from './houses';
import {
  ayanamsaLahiri,
  nakshatraAt,
  navamsaSign,
  dignity,
  combust,
  VEDIC_LORDS,
} from './vedic-rules';
import { vimshottari } from './dasha';
import { computePanchang } from './panchang';
import { detectYogas } from './yogas';
import { SIGNS, signAt, wrap } from './math';
const PLANET_GRAHA: Record<Graha, Planet> = {
  surya: 'sun',
  chandra: 'moon',
  mangala: 'mars',
  budha: 'mercury',
  guru: 'jupiter',
  shukra: 'venus',
  shani: 'saturn',
  rahu: 'north_node',
  ketu: 'north_node',
};
/** Sidereal Rashi+D9 chart, Vimshottari and Yoga; nowISO is an explicit UTC instant for current-period flags. */
export function computeVedic(
  birth: NormalizedBirth,
  nowISO: string,
  opts: { node?: 'mean' | 'true' } = {},
): VedicChart {
  if (birth.jd === null) throw new EngineError('E_EPHEMERIS');
  const jdUT = birth.jd,
    ayanamsa = ayanamsaLahiri(jdUT),
    noonChart = birth.timeUnknown,
    { lat, lng } = birth.place;
  const p = computePositions(
    jdUT,
    ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'north_node'],
    { node: opts.node ?? 'mean' },
  );
  const asc =
    !noonChart && lat !== null && lng !== null
      ? wrap(computeAngles(jdUT, lat, lng).asc - ayanamsa)
      : null;
  const lagna =
    asc === null
      ? null
      : {
          sidLon: asc,
          sign: signAt(asc),
          nakshatra: nakshatraAt(asc).nakshatra,
          pada: nakshatraAt(asc).pada,
          navamsaSign: navamsaSign(asc),
        };
  const bodies = Object.values(Graha).map((key) => {
    const pos = p[PLANET_GRAHA[key] as keyof typeof p],
      sidLon = wrap(pos.lon - ayanamsa + (key === 'ketu' ? 180 : 0)),
      m = nakshatraAt(sidLon);
    return {
      key,
      sidLon,
      sign: signAt(sidLon),
      degInSign: sidLon % 30,
      house: asc === null ? null : ((Math.floor(sidLon / 30) - Math.floor(asc / 30) + 12) % 12) + 1,
      nakshatra: m.nakshatra,
      pada: m.pada,
      retro: pos.retrograde,
      combust: combust(key, sidLon, wrap(p.sun.lon - ayanamsa), pos.retrograde),
      dignity: dignity(key, sidLon),
      navamsaSign: navamsaSign(sidLon),
    };
  });
  const moon = bodies.find((b) => b.key === 'chandra')!,
    moonInfo = nakshatraAt(moon.sidLon);
  let possibleNakshatras: ReturnType<typeof nakshatraAt>['nakshatra'][] | undefined;
  if (noonChart) {
    const day = Temporal.PlainDate.from({
        year: birth.local.year,
        month: birth.local.month,
        day: birth.local.day,
      }).toZonedDateTime({ timeZone: birth.local.tz, plainTime: '00:00' }),
      from = day.epochMilliseconds / 86400000 + 2440587.5,
      to = day.add({ days: 1 }).epochMilliseconds / 86400000 + 2440587.5;
    const first = nakshatraAt(
        wrap(computePositions(from, ['moon']).moon.lon - ayanamsaLahiri(from)),
      ).index,
      last = nakshatraAt(
        wrap(computePositions(to - 1 / 86400, ['moon']).moon.lon - ayanamsaLahiri(to)),
      ).index;
    // DESIGN-GAP: List every mansion traversed during the local civil day, including wrap at Revati/Ashwini.
    possibleNakshatras = Array.from(
      { length: ((last - first + 27) % 27) + 1 },
      (_, i) => nakshatraAt((((first + i) % 27) + 0.5) * (40 / 3)).nakshatra,
    );
  }
  return VedicChartSchema.parse({
    noonChart,
    ayanamsa,
    jdUT,
    lagna,
    bodies,
    houses: lagna
      ? Array.from({ length: 12 }, (_, i) => {
          const sign = SIGNS[(SIGNS.indexOf(lagna.sign) + i) % 12]!;
          return {
            index: i + 1,
            sign,
            lord: VEDIC_LORDS[SIGNS.indexOf(sign)]!,
            occupants: bodies.filter((b) => b.house === i + 1).map((b) => b.key),
          };
        })
      : null,
    moon: {
      nakshatra: moon.nakshatra,
      pada: moon.pada,
      lord: moonInfo.lord,
      rashi: moon.sign,
      ...(possibleNakshatras ? { possibleNakshatras } : {}),
    },
    dasha: vimshottari(
      jdUT,
      moon.sidLon,
      Temporal.Instant.from(nowISO).epochMilliseconds / 86400000 + 2440587.5,
      !noonChart,
    ),
    yogas: detectYogas(bodies, lagna),
    ...(lat !== null && lng !== null
      ? {
          panchangAtBirth: computePanchang(
            Temporal.PlainDate.from(birth.local).toString(),
            { lat, lng, tz: birth.local.tz },
            jdUT,
          ),
        }
      : {}),
  });
}
