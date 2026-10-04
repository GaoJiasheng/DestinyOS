export interface CatalogStar {
  ra: number;
  dec: number;
  mag: number;
  ci: number;
}
/** Decode BSC5 little-endian float32 records; angles are J2000 degrees, ci is B−V. */
export function decodeStars(buffer: ArrayBuffer): CatalogStar[] {
  if (!buffer.byteLength || buffer.byteLength % 16 || buffer.byteLength / 16 > 9110)
    throw new Error('Invalid BSC5 records');
  const view = new DataView(buffer);
  return Array.from({ length: buffer.byteLength / 16 }, (_, i) => {
    const ra = view.getFloat32(i * 16, true),
      dec = view.getFloat32(i * 16 + 4, true);
    const mag = view.getFloat32(i * 16 + 8, true),
      ci = view.getFloat32(i * 16 + 12, true);
    if (![ra, dec, mag, ci].every(Number.isFinite) || ra < 0 || ra >= 360 || Math.abs(dec) > 90)
      throw new Error('Invalid BSC5 star');
    return { ra, dec, mag, ci };
  });
}
/** Equatorial Cartesian unit vector in the Three scene's Y-north convention. */
export function equatorialPoint(ra: number, dec: number, radius = 100): [number, number, number] {
  const a = (ra * Math.PI) / 180,
    d = (dec * Math.PI) / 180;
  return [
    radius * Math.cos(d) * Math.cos(a),
    radius * Math.sin(d),
    radius * Math.cos(d) * Math.sin(a),
  ];
}
