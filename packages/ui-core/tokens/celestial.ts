export interface CatalogStar {
  ra: number;
  dec: number;
  mag: number;
  ci: number;
}
/** Decode the shared public-domain BSC5 float32 catalog (angles in J2000 degrees). */
export function decodeStars(buffer: ArrayBuffer): CatalogStar[] {
  if (!buffer.byteLength || buffer.byteLength % 16 || buffer.byteLength / 16 > 9110)
    throw new Error('Invalid BSC5 records');
  const view = new DataView(buffer);
  return Array.from({ length: buffer.byteLength / 16 }, (_, i) => {
    const values = [0, 4, 8, 12].map((offset) => view.getFloat32(i * 16 + offset, true));
    const [ra, dec, mag, ci] = values as [number, number, number, number];
    if (!values.every(Number.isFinite) || ra < 0 || ra >= 360 || Math.abs(dec) > 90)
      throw new Error('Invalid BSC5 star');
    return { ra, dec, mag, ci };
  });
}
/** Three scene Cartesian vector, Y north; ra/dec in degrees. */
export function equatorialPoint(ra: number, dec: number, radius = 100): [number, number, number] {
  const a = (ra * Math.PI) / 180,
    d = (dec * Math.PI) / 180;
  return [
    radius * Math.cos(d) * Math.cos(a),
    radius * Math.sin(d),
    radius * Math.cos(d) * Math.sin(a),
  ];
}
/** Platform-neutral scene descriptors shared by WebGL and native expo-gl. */
export const celestialScene = {
  sphere: [1.55, 24, 12] as [number, number, number],
  ecliptic: [1.6, 0.03, 4, 96] as [number, number, number, number],
  planetRadius: (index: number) => 1.4 + (index % 3) * 0.08,
};
/** Shared wheel point; longitude in degrees, dimensions in points. */
export function wheelPoint(lon: number, radius: number, center: number) {
  return {
    x: center + Math.cos((-lon * Math.PI) / 180) * radius,
    y: center + Math.sin((-lon * Math.PI) / 180) * radius,
  };
}
/** B−V color interpolation and magnitude brightness shared with the Web star shader. */
export function starAppearance(star: CatalogStar): [number, number, number, number] {
  const colors = [
    [156, 191, 255],
    [247, 245, 255],
    [255, 225, 160],
    [255, 181, 108],
  ];
  const from = star.ci < 0.6 ? colors[1]! : colors[2]!;
  const to = star.ci < 0 ? colors[0]! : star.ci < 0.6 ? colors[2]! : colors[3]!;
  const t =
    star.ci < 0
      ? Math.min(1, -star.ci / 0.4)
      : star.ci < 0.6
        ? star.ci / 0.6
        : Math.min(1, (star.ci - 0.6) / 1.4);
  return [0, 1, 2]
    .map((i) => (from[i]! + (to[i]! - from[i]!) * t) / 255)
    .concat(Math.max(0.15, Math.min(1, 2.512 ** (-star.mag * 0.35)))) as [
    number,
    number,
    number,
    number,
  ];
}
