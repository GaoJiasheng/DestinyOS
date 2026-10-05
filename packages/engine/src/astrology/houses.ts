import * as Astronomy from 'astronomy-engine';
import { type HouseSystem } from '@tianji/shared';
import { EngineError } from '../common/error';
import { astroTime } from './ephemeris';
import { DEG, wrap, signed } from './math';
/** Greenwich mean sidereal angle (degrees), IAU/Meeus polynomial in UT. */
export function gmst(jdUT: number): number {
  const t = (jdUT - 2451545) / 36525;
  return wrap(
    280.46061837 +
      360.98564736629 * (jdUT - 2451545) +
      0.000387933 * t * t -
      (t * t * t) / 38710000,
  );
}
/** Mean local sidereal angle, east-positive longitude in degrees. */
export const lst = (jdUT: number, lng: number): number => wrap(gmst(jdUT) + lng);
/** ASC/MC/RAMC and true obliquity in degrees; geographic north/east positive. */
export function computeAngles(
  jdUT: number,
  lat: number,
  lng: number,
): { asc: number; mc: number; ramc: number; obliquity: number } {
  const time = astroTime(jdUT),
    obliquity = Astronomy.e_tilt(time).tobl,
    ramc = wrap(Astronomy.SiderealTime(time) * 15 + lng),
    t = ramc * DEG,
    e = obliquity * DEG;
  let asc = wrap(
    Math.atan2(-Math.cos(t), Math.sin(t) * Math.cos(e) + Math.tan(lat * DEG) * Math.sin(e)) / DEG +
      180,
  );
  const mc = wrap(Math.atan2(Math.sin(t) / Math.cos(e), Math.cos(t)) / DEG);
  // DESIGN-GAP: At polar latitudes select the eastern ecliptic/horizon intersection, including when MC is below the horizon.
  if (wrap(asc - mc) > 180) asc = wrap(asc + 180);
  return { asc, mc, ramc, obliquity };
}
const raToLon = (ra: number, e: number): number =>
  wrap(Math.atan2(Math.sin(ra * DEG) / Math.cos(e * DEG), Math.cos(ra * DEG)) / DEG);
/** Twelve cusp longitudes in degrees. Placidus trisects semidiurnal/nocturnal arcs by convergent iteration; >66° falls back to Whole Sign. Koch is not a first-release school. */
export function computeHouses(
  system: HouseSystem,
  asc: number,
  mc: number,
  lat: number,
  obliquity: number,
): number[] {
  if (system === 'koch') throw new EngineError('E_UNSUPPORTED_SCHOOL');
  if (system === 'whole_sign' || (system === 'placidus' && Math.abs(lat) > 66))
    return Array.from({ length: 12 }, (_, i) => wrap(Math.floor(asc / 30) * 30 + i * 30));
  if (system === 'equal') return Array.from({ length: 12 }, (_, i) => wrap(asc + i * 30));
  const e = obliquity * DEG,
    phi = lat * DEG,
    ramc = wrap(Math.atan2(Math.sin(mc * DEG) * Math.cos(e), Math.cos(mc * DEG)) / DEG);
  const cusp = (offset: number, fraction: number, nocturnal: boolean): number => {
    let lon = raToLon(ramc + offset + fraction * 90, obliquity);
    for (let iteration = 0; iteration < 100; iteration++) {
      const decl = Math.asin(Math.sin(e) * Math.sin(lon * DEG));
      const arg = -Math.tan(phi) * Math.tan(decl);
      if (Math.abs(arg) >= 1) throw new EngineError('E_EPHEMERIS');
      const semi = Math.acos(arg) / DEG;
      const next = raToLon(ramc + offset + fraction * (nocturnal ? 180 - semi : semi), obliquity);
      if (Math.abs(signed(next - lon)) < 1e-9) return next;
      // Damping handles near-polar slow convergence.
      lon = wrap(lon + signed(next - lon) * 0.7);
    }
    throw new EngineError('E_EPHEMERIS');
  };
  const h11 = cusp(0, 1 / 3, false),
    h12 = cusp(0, 2 / 3, false),
    h2 = cusp(180, -2 / 3, true),
    h3 = cusp(180, -1 / 3, true);
  return [
    asc,
    h2,
    h3,
    wrap(mc + 180),
    wrap(h11 + 180),
    wrap(h12 + 180),
    wrap(asc + 180),
    wrap(h2 + 180),
    wrap(h3 + 180),
    mc,
    h11,
    h12,
  ];
}
/** House 1..12 containing longitude, cusp-inclusive, wrap-safe. */
export function houseAt(lon: number, cusps: readonly number[]): number {
  const index = cusps.findIndex((cusp, i) => wrap(lon - cusp) < wrap(cusps[(i + 1) % 12]! - cusp));
  if (index < 0) throw new EngineError('E_EPHEMERIS');
  return index + 1;
}
