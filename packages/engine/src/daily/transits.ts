import { Temporal } from '@js-temporal/polyfill';
import * as Astronomy from 'astronomy-engine';
import type { AstroChart, DailyChart, DailyTransit } from '@tianji/shared';
import { computePositions, astroTime, moonPhase, type Position } from '../astrology/ephemeris';
import { signAt, signed, wrap } from '../astrology/math';
const FAST = ['sun', 'moon', 'mercury', 'venus', 'mars'] as const;
const SLOW = ['jupiter', 'saturn'] as const;
const ANGLES = { conjunction: 0, opposition: 180, square: 90, trine: 120, sextile: 60 } as const;
/** Daily-specific orb limits (no natal luminary bonus), deterministic tightest-first ordering. */
export function findDailyTransits(
  positions: Record<(typeof FAST)[number] | (typeof SLOW)[number], Position>,
  natal: AstroChart | null,
  timeUnknown = false,
): DailyTransit[] {
  if (!natal) return [];
  // 04 §5: unknown-time daily comparisons use only natal Sun/Moon, and never angles.
  const targets: { key: DailyTransit['natal']; lon: number }[] = natal.bodies
    .filter((body) =>
      (timeUnknown || natal.noonChart
        ? ['sun', 'moon']
        : ([...FAST] as readonly string[])
      ).includes(body.key),
    )
    .map((body) => ({ key: body.key, lon: body.lon }));
  if (!timeUnknown && !natal.noonChart && natal.angles)
    targets.push({ key: 'asc', lon: natal.angles.asc }, { key: 'mc', lon: natal.angles.mc });
  const hits: DailyTransit[] = [];
  for (const transiting of [...FAST, ...SLOW]) {
    const slow = SLOW.some((body) => body === transiting),
      position = positions[transiting];
    const limit = transiting === 'moon' ? 3 : slow ? 1 : 1.5;
    for (const target of targets) {
      if (slow && !['sun', 'moon', 'asc'].includes(target.key)) continue;
      const delta = signed(position.lon - target.lon);
      for (const [aspect, angle] of Object.entries(ANGLES) as [keyof typeof ANGLES, number][]) {
        const orb = Math.abs(Math.abs(delta) - angle);
        if (orb <= limit + 1e-10) {
          const error = signed(delta - (delta < 0 ? -angle : angle));
          hits.push({
            transiting,
            natal: target.key,
            aspect,
            orb,
            applying: error * position.speed < 0,
          });
        }
      }
    }
  }
  return hits
    .sort(
      (a, b) =>
        a.orb - b.orb ||
        `${a.transiting}.${a.natal}.${a.aspect}`.localeCompare(
          `${b.transiting}.${b.natal}.${b.aspect}`,
        ),
    )
    .slice(0, 3);
}
export function dailyAstro(
  localDate: string,
  tz: string,
  natal: AstroChart | null,
  timeUnknown: boolean,
): DailyChart['astro'] {
  const noonUT = Temporal.PlainDate.from(localDate).toZonedDateTime({
    timeZone: 'UTC',
    plainTime: '12:00',
  });
  const jd = noonUT.epochMilliseconds / 86400000 + 2440587.5;
  const positions = computePositions(jd, [...FAST, ...SLOW]);
  const day = Temporal.PlainDate.from(localDate).toZonedDateTime({
    timeZone: tz,
    plainTime: '00:00',
  });
  const start = day.epochMilliseconds / 86400000 + 2440587.5,
    end = day.add({ days: 1 }).epochMilliseconds / 86400000 + 2440587.5;
  const initialMoon = computePositions(start, ['moon']).moon.lon,
    initialSign = signAt(initialMoon);
  let ingress: DailyChart['astro']['moonIngress'];
  if (signAt(computePositions(end - 1e-9, ['moon']).moon.lon) !== initialSign) {
    let low = start,
      high = end;
    for (let i = 0; i < 35; i++) {
      const mid = (low + high) / 2;
      if (signAt(computePositions(mid, ['moon']).moon.lon) === initialSign) low = mid;
      else high = mid;
    }
    ingress = {
      sign: signAt(computePositions(high, ['moon']).moon.lon),
      at: new Date((high - 2440587.5) * 86400000).toISOString(),
    };
  }
  // DESIGN-GAP: A new/full-moon day requires the exact lunation instant within the user's civil day, not merely membership in the broad eight-phase bin.
  let lunation: DailyChart['astro']['lunation'] = null;
  for (const [angle, name] of [
    [0, 'new_moon'],
    [180, 'full_moon'],
  ] as const) {
    const event = Astronomy.SearchMoonPhase(angle, astroTime(start), end - start);
    if (event && event.ut + 2451545 >= start && event.ut + 2451545 < end) lunation = name;
  }
  return {
    moonSign: signAt(positions.moon.lon),
    moonDegree: wrap(positions.moon.lon) % 30,
    sunSign: signAt(positions.sun.lon),
    moonPhase: moonPhase(jd),
    transits: findDailyTransits(positions, natal, timeUnknown),
    moonChangesSign: Boolean(ingress),
    ...(ingress ? { moonIngress: ingress } : {}),
    retrogrades: (['mercury', 'venus', 'mars'] as const).filter(
      (body) => positions[body].speed < 0,
    ),
    lunation,
  };
}
