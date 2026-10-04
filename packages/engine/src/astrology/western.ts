import {
  AstroChartSchema,
  Planet,
  type AstroChart,
  type NormalizedBirth,
  type HouseSystem,
  type Sign,
} from '@tianji/shared';
import { EngineError } from '../common/error';
import { computePositions, moonPhase, astroTime } from './ephemeris';
import { computeAngles, computeHouses, houseAt } from './houses';
import { aspects, aspectPatterns } from './aspects';
import { distance, SIGNS, signAt, wrap } from './math';
import { e_tilt } from 'astronomy-engine';
export const TRADITIONAL_RULERS: Record<Sign, Planet> = {
  aries: 'mars',
  taurus: 'venus',
  gemini: 'mercury',
  cancer: 'moon',
  leo: 'sun',
  virgo: 'mercury',
  libra: 'venus',
  scorpio: 'mars',
  sagittarius: 'jupiter',
  capricorn: 'saturn',
  aquarius: 'saturn',
  pisces: 'jupiter',
};
export const MODERN_RULERS: Record<Sign, Planet> = {
  ...TRADITIONAL_RULERS,
  scorpio: 'pluto',
  aquarius: 'uranus',
  pisces: 'neptune',
};
export interface WesternOptions {
  houseSystem?: HouseSystem;
  node?: 'mean' | 'true';
  rulership?: 'modern' | 'traditional';
  orbs?: Parameters<typeof aspects>[1];
}
/** Elements/modalities/polarity of ten planets, hemisphere/quadrant counts and same-sign/house stelliums. */
export function chartStats(bodies: AstroChart['bodies']): AstroChart['stats'] {
  // DESIGN-GAP: Statistical weights are equal for the ten planets; calculated points and Chiron do not count as stellium planets.
  const planets = bodies.filter((b) => !['north_node', 'chiron', 'lilith'].includes(b.key));
  const elements = { fire: 0, earth: 0, air: 0, water: 0 },
    modalities = { cardinal: 0, fixed: 0, mutable: 0 },
    polarity = { positive: 0, negative: 0 };
  const hemispheres = { upper: 0, lower: 0, eastern: 0, western: 0 },
    quadrants = [0, 0, 0, 0],
    stelliums: AstroChart['stats']['stelliums'] = [];
  for (const p of planets) {
    const sign = SIGNS.indexOf(p.sign),
      el = Object.keys(elements)[sign % 4] as keyof typeof elements,
      mode = Object.keys(modalities)[sign % 3] as keyof typeof modalities;
    elements[el]++;
    modalities[mode]++;
    polarity[sign % 2 === 0 ? 'positive' : 'negative']++;
    if (p.house !== null) {
      hemispheres[p.house >= 7 ? 'upper' : 'lower']++;
      hemispheres[p.house >= 4 && p.house <= 9 ? 'western' : 'eastern']++;
      quadrants[Math.floor((p.house - 1) / 3)]!++;
    }
  }
  for (const sign of SIGNS) {
    const group = planets.filter((p) => p.sign === sign);
    if (group.length >= 3) stelliums.push({ sign, bodies: group.map((p) => p.key) });
  }
  for (let house = 1; house <= 12; house++) {
    const group = planets.filter((p) => p.house === house);
    if (group.length >= 3) stelliums.push({ house, bodies: group.map((p) => p.key) });
  }
  const withHouses = planets.some((p) => p.house !== null);
  return {
    elements,
    modalities,
    polarity,
    hemispheres: withHouses ? hemispheres : null,
    quadrants: withHouses ? quadrants : null,
    stelliums,
  };
}
/** Mutual domicile reception pairs for the selected sign-ruler table, each unordered pair once. */
export function mutualReceptions(
  bodies: readonly Pick<AstroChart['bodies'][number], 'key' | 'sign'>[],
  rulers: Record<Sign, Planet> = MODERN_RULERS,
): Array<[Planet, Planet]> {
  const result: Array<[Planet, Planet]> = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!,
        b = bodies[j]!;
      if (rulers[a.sign] === b.key && rulers[b.sign] === a.key) result.push([a.key, b.key]);
    }
  return result;
}
/** Western natal chart from normalized UT birth; house axes omitted without a clock or coordinates. */
export function computeAstrology(birth: NormalizedBirth, opts: WesternOptions = {}): AstroChart {
  if (birth.jd === null) throw new EngineError('E_EPHEMERIS');
  const jdUT = birth.jd,
    noonChart = birth.timeUnknown,
    { lat, lng } = birth.place;
  const angles = !noonChart && lat !== null && lng !== null ? computeAngles(jdUT, lat, lng) : null;
  const houseSystem: HouseSystem =
    opts.houseSystem === 'placidus' || opts.houseSystem === undefined
      ? angles && Math.abs(lat!) > 66
        ? 'whole_sign'
        : 'placidus'
      : opts.houseSystem;
  if (houseSystem === 'koch') throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const rulers = opts.rulership === 'traditional' ? TRADITIONAL_RULERS : MODERN_RULERS;
  const cusps = angles
    ? computeHouses(houseSystem, angles.asc, angles.mc, lat!, angles.obliquity)
    : null;
  const positions = computePositions(jdUT, Object.values(Planet), { node: opts.node ?? 'true' });
  const bodies = Object.values(Planet).map((key) => {
    const p = positions[key];
    return {
      key,
      lon: p.lon,
      lat: p.lat,
      sign: signAt(p.lon),
      degInSign: p.lon % 30,
      retro: p.retrograde,
      speed: p.speed,
      house: cusps ? houseAt(p.lon, cusps) : null,
      ...(cusps ? { nearCusp: cusps.some((c) => distance(c, p.lon) <= 3) } : {}),
      anaretic: p.lon % 30 >= 29,
      ...(key === 'chiron' ? { approximate: true } : {}),
      ...(noonChart && key === 'moon' ? { uncertaintyDegrees: 6 } : {}),
    };
  });
  const receptions = mutualReceptions(bodies, rulers);
  const edges = aspects(positions, opts.orbs);
  return AstroChartSchema.parse({
    noonChart,
    jdUT,
    obliquity: angles?.obliquity ?? e_tilt(astroTime(jdUT)).tobl,
    houseSystem,
    bodies,
    angles: angles
      ? { asc: angles.asc, mc: angles.mc, dsc: wrap(angles.asc + 180), ic: wrap(angles.mc + 180) }
      : null,
    houses: cusps
      ? cusps.map((cusp, i) => ({
          index: i + 1,
          cusp,
          sign: signAt(cusp),
          ruler: rulers[signAt(cusp)],
        }))
      : null,
    aspects: edges,
    stats: chartStats(bodies),
    rulers: {
      chartRuler: angles ? rulers[signAt(angles.asc)] : null,
      mutualReceptions: receptions,
    },
    moonPhase: moonPhase(jdUT),
    patterns: aspectPatterns(edges),
  });
}
