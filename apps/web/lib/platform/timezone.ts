import { decode } from 'geobuf';
import Pbf from 'pbf';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { platform } from './environment';
import { resourceBytes, resourceText } from './resources';
import { nodeTimezone } from './timezone-node';
type Quad = number[] | { pos: number; len: number } | { a?: Quad; b?: Quad; c?: Quad; d?: Quad };
interface BoundaryIndex {
  timezones: string[];
  lookup: Exclude<Quad, number[] | { pos: number; len: number }>;
}
let index: Promise<BoundaryIndex> | undefined;
const size = 4 * 1024 * 1024;
function ocean(lng: number): string[] {
  const result: string[] = [];
  for (let offset = -12; offset <= 12; offset++) {
    const center = offset * -15;
    if (lng >= Math.max(-180, center - 7.5) && lng <= Math.min(180, center + 7.5))
      result.push(`Etc/GMT${offset === 0 ? '' : offset > 0 ? '+' + offset : offset}`);
  }
  return lng === -180 || lng === 180 ? ['Etc/GMT+12', 'Etc/GMT-12'] : result;
}
/** Preserve geo-tz's quadtree and polygon rules using the same 1970+ data in Workers Assets. */
// DESIGN-GAP: Split the original 25MiB geo.dat into 4MiB assets to stay below Cloudflare's 25MiB per-file limit; no approximate timezone replacement.
export async function lookupTimezone(lat: number, lng: number): Promise<string[]> {
  if (platform() !== 'cloudflare') return nodeTimezone(lat, lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new Error('Invalid coordinates');
  if (lat === 90)
    return Array.from({ length: 25 }, (_, i) => {
      const offset = i - 12;
      return `Etc/GMT${offset === 0 ? '' : offset > 0 ? '+' + offset : offset}`;
    });
  const originalLng = lng;
  lat = Math.max(-89.9999, Math.min(89.9999, lat));
  lng = Math.max(-179.9999, Math.min(179.9999, lng));
  index ??= resourceText('geo/index.json').then((text) => JSON.parse(text) as BoundaryIndex);
  const data = await index;
  let node: Quad | undefined = data.lookup;
  let top = 89.9999,
    bottom = -89.9999,
    left = -179.9999,
    right = 179.9999;
  while (node && !Array.isArray(node) && !('pos' in node)) {
    const midLat = (top + bottom) / 2,
      midLng = (left + right) / 2;
    if (lat >= midLat && lng >= midLng) {
      node = node.a;
      bottom = midLat;
      left = midLng;
    } else if (lat >= midLat) {
      node = node.b;
      bottom = midLat;
      right = midLng;
    } else if (lng < midLng) {
      node = node.c;
      top = midLat;
      right = midLng;
    } else {
      node = node.d;
      top = midLat;
      left = midLng;
    }
  }
  if (!node) return ocean(originalLng);
  if (Array.isArray(node)) return node.map((i) => data.timezones[i]!);
  if (!('pos' in node)) throw new Error('Invalid boundary index');
  const bytes = new Uint8Array(node.len);
  for (let at = node.pos; at < node.pos + node.len;) {
    const part = await resourceBytes(`geo/${Math.floor(at / size)}.bin`);
    const count = Math.min(part.length - (at % size), node.pos + node.len - at);
    if (count <= 0) throw new Error('Invalid boundary data');
    bytes.set(part.subarray(at % size, (at % size) + count), at - node.pos);
    at += count;
  }
  const features = decode(new Pbf(bytes));
  if (features.type !== 'FeatureCollection') throw new Error('Invalid boundary features');
  const result = features.features
    .filter(
      (feature) =>
        (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
        booleanPointInPolygon(point([lng, lat]), feature.geometry),
    )
    .flatMap((feature) =>
      typeof feature.properties?.tzid === 'string' ? [feature.properties.tzid] : [],
    );
  return result.length ? result : ocean(originalLng);
}
