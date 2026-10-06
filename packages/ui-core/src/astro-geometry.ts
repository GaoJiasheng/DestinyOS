import { Sign, type Planet, type Aspect } from '@tianji/shared';
export const SIGNS = Object.values(Sign);
export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const PLANET_GLYPHS: Record<Planet, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  north_node: '☊',
  chiron: '⚷',
  lilith: '⚸',
};
/** Normalize a longitude in degrees to [0, 360). */
export const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;
/** Chart point with ASC fixed at nine o'clock; zodiac/house order increases counterclockwise. */
export function wheelPoint(lon: number, asc: number, radius: number) {
  const angle = ((180 - lon + asc) * Math.PI) / 180;
  return { x: 200 + radius * Math.cos(angle), y: 200 + radius * Math.sin(angle) };
}
/** Circular collision relaxation in degrees; leader lines retain true longitudes, including across 0°. */
export function spreadLongitudes(bodies: readonly { key: Planet; lon: number }[], gap = 7) {
  if (bodies.length < 2) return bodies.map((b) => ({ ...b, displayLon: b.lon }));
  const sorted = bodies
    .map((b) => ({ ...b, displayLon: wrap(b.lon) }))
    .sort((a, b) => a.lon - b.lon || a.key.localeCompare(b.key));
  // DESIGN-GAP: Symmetric circular relaxation minimizes local displacement without choosing a special zodiac boundary.
  const minimum = Math.min(gap, 360 / sorted.length);
  for (let iteration = 0; iteration < 1024; iteration++) {
    let largest = 0;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const b = sorted[(i + 1) % sorted.length]!;
      const distance = b.displayLon - a.displayLon + (i === sorted.length - 1 ? 360 : 0);
      const correction = Math.max(0, minimum - distance) / 2;
      a.displayLon -= correction;
      b.displayLon += correction;
      largest = Math.max(largest, correction);
    }
    if (largest < 1e-8) break;
  }
  return sorted.map((b) => ({ ...b, displayLon: wrap(b.displayLon) }));
}
/** Semantic color token for aspect lines; preserve the Web conjunction's green emphasis. */
export function aspectColorToken(
  type: Aspect,
): 'success' | 'element-water' | 'element-fire' | 'line-2' {
  if (type === 'conjunction') return 'success';
  if (type === 'trine' || type === 'sextile') return 'element-water';
  if (type === 'square' || type === 'opposition') return 'element-fire';
  return 'line-2';
}
/** Web CSS reference to the same aspect token consumed by native themeColors. */
export function aspectColor(type: Aspect): string {
  return `var(--${aspectColorToken(type)})`;
}
