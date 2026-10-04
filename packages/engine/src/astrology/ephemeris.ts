import * as Astronomy from 'astronomy-engine';
import { Planet, type Body } from '@tianji/shared';
import { EngineError } from '../common/error';
import { DEG, wrap, signed } from './math';
export interface Position {
  lon: number;
  lat: number;
  speed: number;
  retrograde: boolean;
}
const astronomyBodies = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};
/** Astronomy-engine time, in UT days since J2000, from UT Julian day. */
export function astroTime(jdUT: number): Astronomy.AstroTime {
  if (!Number.isFinite(jdUT)) throw new EngineError('E_EPHEMERIS');
  return new Astronomy.AstroTime(jdUT - 2451545);
}
/** Mean lunar ascending-node longitude (Meeus polynomial, degrees of date). */
export function meanNorthNode(jdUT: number): number {
  const t = astroTime(jdUT).tt / 36525;
  return wrap(
    125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441 - t ** 4 / 60616000,
  );
}
/** Osculating true node from the Moon's position/velocity plane, longitude of date. */
export function trueNorthNode(jdUT: number): number {
  const time = astroTime(jdUT),
    s = Astronomy.GeoMoonState(time);
  const h = new Astronomy.Vector(
    s.y * s.vz - s.z * s.vy,
    s.z * s.vx - s.x * s.vz,
    s.x * s.vy - s.y * s.vx,
    time,
  );
  const e = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(time), h);
  return wrap(Math.atan2(e.x, -e.y) / DEG);
}
/** Mean lunar apogee (Lilith), Meeus mean perigee plus 180°, degrees. */
export function meanLilith(jdUT: number): number {
  const t = astroTime(jdUT).tt / 36525;
  return wrap(
    83.3532465 + 4069.0137287 * t - 0.01032 * t * t - t ** 3 / 80053 + t ** 4 / 18999000 + 180,
  );
}
function chiron(jdUT: number): { lon: number; lat: number } {
  const time = astroTime(jdUT);
  // DESIGN-GAP: Chiron uses a two-body approximation, JPL SBDB orbit 171 at epoch 2461200.5 (J2000 ecliptic), no perturbations. Never claim ±1′ for Chiron.
  // Source: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=2060&full-prec=true
  const a = 13.68426760850124,
    e = 0.3797656311453571,
    i = 6.930574468846328 * DEG,
    node = 209.2961258613147 * DEG,
    peri = 339.2878326589729 * DEG;
  const m = wrap(216.7198966018106 + 0.0194702593257484 * (time.tt + 2451545 - 2461200.5)) * DEG;
  let eccentric = m;
  for (let j = 0; j < 12; j++)
    eccentric -= (eccentric - e * Math.sin(eccentric) - m) / (1 - e * Math.cos(eccentric));
  const v = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(eccentric), Math.cos(eccentric) - e),
    r = a * (1 - e * Math.cos(eccentric)),
    u = v + peri;
  const helio = Astronomy.RotateVector(
    Astronomy.Rotation_ECL_EQJ(),
    new Astronomy.Vector(
      r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(i)),
      r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(i)),
      r * Math.sin(u) * Math.sin(i),
      time,
    ),
  );
  const earth = Astronomy.HelioVector(Astronomy.Body.Earth, time);
  const p = Astronomy.Ecliptic(
    new Astronomy.Vector(helio.x - earth.x, helio.y - earth.y, helio.z - earth.z, time),
  );
  return { lon: p.elon, lat: p.elat };
}
function longitude(jd: number, body: Body, node: 'mean' | 'true'): { lon: number; lat: number } {
  if (body === Planet.north_node)
    return { lon: node === 'mean' ? meanNorthNode(jd) : trueNorthNode(jd), lat: 0 };
  if (body === Planet.lilith) return { lon: meanLilith(jd), lat: 0 };
  if (body === Planet.chiron) return chiron(jd);
  const p = Astronomy.Ecliptic(Astronomy.GeoVector(astronomyBodies[body], astroTime(jd), true));
  return { lon: p.elon, lat: p.elat };
}
/** Apparent geocentric longitude/latitude (degrees), speed (degrees/UT day), including aberration. */
export function computePositions<B extends Body>(
  jdUT: number,
  bodies: readonly B[],
  opts: { topocentric?: false; node?: 'mean' | 'true' } = {},
): Record<B, Position> {
  const result = {} as Record<B, Position>;
  try {
    astroTime(jdUT);
    for (const body of bodies) {
      const p = longitude(jdUT, body, opts.node ?? 'true');
      const speed =
        signed(
          longitude(jdUT + 0.005, body, opts.node ?? 'true').lon -
            longitude(jdUT - 0.005, body, opts.node ?? 'true').lon,
        ) / 0.01;
      result[body] = { ...p, speed, retrograde: speed < 0 };
    }
  } catch {
    throw new EngineError('E_EPHEMERIS');
  }
  return result;
}
/** Eight-phase lunar name key and elongation angle in degrees. */
export function moonPhase(jdUT: number): { name: string; angle: number } {
  const angle = Astronomy.MoonPhase(astroTime(jdUT));
  const names = [
    'new_moon',
    'waxing_crescent',
    'first_quarter',
    'waxing_gibbous',
    'full_moon',
    'waning_gibbous',
    'last_quarter',
    'waning_crescent',
  ];
  return { name: names[Math.floor(wrap(angle + 22.5) / 45)]!, angle };
}
/** Sunrise/sunset UT Julian days after start, observer coordinates in degrees, null in polar night/day. */
export function sunriseSunset(
  jdStart: number,
  lat: number,
  lng: number,
): { sunrise: number | null; sunset: number | null } {
  const observer = new Astronomy.Observer(lat, lng, 0),
    time = astroTime(jdStart);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, 1, time, 1),
    set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, time, 1);
  return { sunrise: rise ? rise.ut + 2451545 : null, sunset: set ? set.ut + 2451545 : null };
}
