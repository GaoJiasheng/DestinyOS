import type { VedicChart, Sign } from '@tianji/shared';
import { SIGNS } from './astro-geometry';
export type Division = 'D1' | 'D9';
// DESIGN-GAP: D9 degrees are the exact ninth-harmonic longitude; they are not copied from D1.
/** Sign and degree positions for D1 or Navamsa, with no inferred Lagna for noon charts. */
export function vedicDivision(chart: VedicChart, division: Division) {
  const lagna: Sign | null = chart.noonChart
    ? null
    : ((division === 'D9' ? chart.lagna?.navamsaSign : chart.lagna?.sign) ?? null);
  return {
    lagna,
    bodies: chart.bodies.map((b) => ({
      ...b,
      sign: division === 'D9' ? b.navamsaSign : b.sign,
      degree: division === 'D9' ? (b.sidLon * 9) % 30 : b.degInSign,
    })),
  };
}
/** Fixed signs clockwise around the South Indian 4x4 perimeter; Aries is top row's second cell. */
export const SOUTH_CELLS = [
  [1, 0],
  [2, 0],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [2, 3],
  [1, 3],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
] as const;
/** Twelve fixed house polygons in the North Indian diamond, counterclockwise from the upper center. */
export const NORTH_CELLS = [
  { points: '200,0 300,100 200,200 100,100', x: 200, y: 67 },
  { points: '0,0 200,0 100,100', x: 100, y: 27 },
  { points: '0,0 100,100 0,200', x: 40, y: 92 },
  { points: '0,200 100,100 200,200 100,300', x: 100, y: 163 },
  { points: '0,200 100,300 0,400', x: 40, y: 287 },
  { points: '0,400 100,300 200,400', x: 100, y: 357 },
  { points: '200,200 300,300 200,400 100,300', x: 200, y: 277 },
  { points: '200,400 300,300 400,400', x: 300, y: 357 },
  { points: '400,200 400,400 300,300', x: 360, y: 287 },
  { points: '200,200 300,100 400,200 300,300', x: 300, y: 163 },
  { points: '400,0 400,200 300,100', x: 360, y: 92 },
  { points: '200,0 400,0 300,100', x: 300, y: 27 },
] as const;
/** Zodiac sign occupying a fixed house given the division's rising sign. */
export function houseSign(lagna: Sign, index: number): Sign {
  return SIGNS[(SIGNS.indexOf(lagna) + index) % 12]!;
}
