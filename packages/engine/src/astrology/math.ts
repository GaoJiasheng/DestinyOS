import { Sign } from '@tianji/shared';
export const DEG = Math.PI / 180;
export const SIGNS = Object.values(Sign);
/** Wrap a degree angle to [0,360). */
export const wrap = (angle: number): number => {
  const remainder = angle % 360;
  return remainder < 0 ? remainder + 360 : remainder;
};
/** Floor a division index, snapping only floating-point noise at exact boundaries. */
export function divisionIndex(lon: number, divisions: number): number {
  const scaled = (wrap(lon) * divisions) / 360;
  const nearest = Math.round(scaled);
  return Math.floor(Math.abs(scaled - nearest) < 1e-12 ? nearest : scaled) % divisions;
}
/** Signed shortest angular difference in degrees. */
export const signed = (angle: number): number => wrap(angle + 180) - 180;
/** Absolute shortest angular distance in degrees. */
export const distance = (a: number, b: number): number => Math.abs(signed(a - b));
/** Zodiac sign for tropical or sidereal longitude in degrees. */
export const signAt = (lon: number): Sign => SIGNS[Math.floor(wrap(lon) / 30)]!;
