import { Graha, Nakshatra, type Sign, type VedicChart } from '@tianji/shared';
import { astroTime } from './ephemeris';
import { distance, SIGNS, signAt, wrap, divisionIndex } from './math';
export const DASHA_LORDS = [
  Graha.ketu,
  Graha.shukra,
  Graha.surya,
  Graha.chandra,
  Graha.mangala,
  Graha.rahu,
  Graha.guru,
  Graha.shani,
  Graha.budha,
] as const;
export const DASHA_YEARS: Record<Graha, number> = {
  ketu: 7,
  shukra: 20,
  surya: 6,
  chandra: 10,
  mangala: 7,
  rahu: 18,
  guru: 16,
  shani: 19,
  budha: 17,
};
export const VEDIC_LORDS: readonly Graha[] = [
  Graha.mangala,
  Graha.shukra,
  Graha.budha,
  Graha.chandra,
  Graha.surya,
  Graha.budha,
  Graha.shukra,
  Graha.mangala,
  Graha.guru,
  Graha.shani,
  Graha.shani,
  Graha.guru,
];
/** Lahiri/Chitrapaksha mean ayanamsa degrees, calibrated 23°51′25.532″ J2000 plus general precession. */
export function ayanamsaLahiri(jdUT: number): number {
  // DESIGN-GAP: Mean Lahiri polynomial rather than moving-Spica true Chitrapaksha; calibrated to the documented J2000 1′ anchor tolerance.
  const t = astroTime(jdUT).tt / 36525;
  return 23.8570922222 + (5028.796195 * t + 1.1054348 * t * t + 0.00007964 * t ** 3) / 3600;
}
/** Nakshatra 0..26, Pada 1..4 and Vimshottari lord from sidereal longitude, degrees. */
export function nakshatraAt(lon: number): {
  nakshatra: Nakshatra;
  pada: number;
  lord: Graha;
  index: number;
} {
  const part = divisionIndex(lon, 108),
    index = Math.floor(part / 4);
  return {
    nakshatra: Nakshatra[index]!,
    pada: (part % 4) + 1,
    lord: DASHA_LORDS[index % 9]!,
    index,
  };
}
/** Navamsa sign using element-specific starts and nine divisions of 3°20′ per sign. */
export function navamsaSign(lon: number): Sign {
  // Each next Rashi starts nine Navamsas later; modulo twelve yields the documented element-specific starts.
  return SIGNS[divisionIndex(lon, 108) % 12]!;
}
const exalted: Partial<Record<Graha, number>> = {
  surya: 0,
  chandra: 1,
  mangala: 9,
  budha: 5,
  guru: 3,
  shukra: 11,
  shani: 6,
};
const moola: Partial<Record<Graha, readonly [number, number, number]>> = {
  surya: [4, 0, 20],
  chandra: [1, 3, 30],
  mangala: [0, 0, 12],
  budha: [5, 15, 20],
  guru: [8, 0, 10],
  shukra: [6, 0, 15],
  shani: [10, 0, 20],
};
const friends: Record<Graha, readonly Graha[]> = {
  surya: ['chandra', 'mangala', 'guru'],
  chandra: ['surya', 'budha'],
  mangala: ['surya', 'chandra', 'guru'],
  budha: ['surya', 'shukra'],
  guru: ['surya', 'chandra', 'mangala'],
  shukra: ['budha', 'shani'],
  shani: ['budha', 'shukra'],
  rahu: [],
  ketu: [],
};
const enemies: Record<Graha, readonly Graha[]> = {
  surya: ['shukra', 'shani'],
  chandra: [],
  mangala: ['budha'],
  budha: ['chandra'],
  guru: ['budha', 'shukra'],
  shukra: ['surya', 'chandra'],
  shani: ['surya', 'chandra', 'mangala'],
  rahu: [],
  ketu: [],
};
/** Classical dignity from sidereal longitude; permanent friendship table; nodes neutral (disputed exaltations omitted). */
export function dignity(body: Graha, lon: number): VedicChart['bodies'][number]['dignity'] {
  // DESIGN-GAP: Degree-sensitive Moolatrikona takes priority over sign-wide exaltation; Rahu/Ketu dignities are neutral across schools.
  const sign = SIGNS.indexOf(signAt(lon)),
    degree = wrap(lon) % 30,
    range = moola[body],
    ex = exalted[body];
  if (range && sign === range[0] && degree >= range[1] && degree < range[2]) return 'moolatrikona';
  if (ex !== undefined && sign === ex && !(body === 'budha' && degree >= 20)) return 'exalted';
  if (ex !== undefined && sign === (ex + 6) % 12) return 'debilitated';
  if (body === 'rahu' || body === 'ketu') return 'neutral';
  const lord = VEDIC_LORDS[sign]!;
  if (lord === body) return 'own';
  if (friends[body].includes(lord)) return 'friend';
  if (enemies[body].includes(lord)) return 'enemy';
  return 'neutral';
}
/** Combustion threshold in degrees; Sun and nodes never combust. */
export function combust(body: Graha, lon: number, sunLon: number, retro: boolean): boolean {
  const limits: Partial<Record<Graha, number>> = {
    chandra: 12,
    mangala: 17,
    budha: retro ? 12 : 14,
    guru: 11,
    shukra: retro ? 8 : 10,
    shani: 15,
  };
  return limits[body] !== undefined && distance(lon, sunLon) < limits[body]!;
}
