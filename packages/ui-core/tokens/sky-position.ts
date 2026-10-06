import {
  AstroTime,
  Body,
  Equator,
  Observer,
  SiderealTime,
  Rotation_EQD_EQJ,
  RotateVector,
  Vector,
} from 'astronomy-engine';
import { equatorialPoint } from './celestial';
export interface SkyPlace {
  lat: number;
  lng: number;
}
export const skyBodies = [
  Body.Sun,
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
] as const;
/** Precess today's local zenith into the catalog's J2000 reference frame. */
export function zenithAt(now: Date, place: SkyPlace): [number, number, number] {
  const lst = (SiderealTime(now) * 15 + place.lng + 360) % 360;
  const [x, y, z] = equatorialPoint(lst, place.lat, 1);
  const vector = RotateVector(Rotation_EQD_EQJ(now), new Vector(x, z, y, new AstroTime(now)));
  return [vector.x, vector.z, vector.y];
}
/** Apparent topocentric planet positions in J2000 coordinates, aligned with BSC5. */
export function planetsAt(now: Date, place: SkyPlace) {
  const observer = new Observer(place.lat, place.lng, 0);
  return skyBodies.map((body) => {
    const p = Equator(body, now, observer, false, true);
    return { key: body.toLowerCase(), position: equatorialPoint(p.ra * 15, p.dec, 96) };
  });
}
