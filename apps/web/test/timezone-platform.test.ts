import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { find } from 'geo-tz';
import { lookupTimezone } from '../lib/platform/timezone';
vi.mock('../lib/platform/resources', () => ({
  resourceText: () =>
    readFile('apps/web/node_modules/geo-tz/data/timezones-1970.geojson.index.json', 'utf8'),
  resourceBytes: async (path: string) => {
    const data = await readFile('apps/web/node_modules/geo-tz/data/timezones-1970.geojson.geo.dat');
    const part = Number(path.match(/\/(\d+)\.bin$/)?.[1]);
    return data.subarray(part * 4194304, (part + 1) * 4194304);
  },
}));
afterEach(() => vi.unstubAllEnvs());
it('preserves the original geo-tz result across cities, oceans, boundaries and both poles', async () => {
  vi.stubEnv('PLATFORM', 'cloudflare');
  const points = [
    [39.9, 116.4],
    [1.3521, 103.8198],
    [40.7128, -74.006],
    [51.5074, -0.1278],
    [-33.8688, 151.2093],
    [90, 0],
    [-90, 0],
    [0, -180],
    [0, 180],
    [0, 7.5],
    [27.7, 85.3],
  ];
  for (let lat = -80; lat <= 80; lat += 16)
    for (let lng = -170; lng <= 170; lng += 34) points.push([lat, lng]);
  for (const [lat, lng] of points)
    expect(await lookupTimezone(lat!, lng!), `${lat},${lng}`).toEqual(find(lat!, lng!));
});
