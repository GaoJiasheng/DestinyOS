import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';
// DESIGN-GAP: Task T-30 supersedes 07 §4's cities15000; retain aliases and population for deterministic ranking.
const base = 'https://download.geonames.org/export/dump/';
async function download(file: string) {
  const res = await fetch(base + file);
  if (!res.ok) throw new Error(`GeoNames download failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
const [zip, adminBytes] = await Promise.all([
  download('cities500.zip'),
  download('admin1CodesASCII.txt'),
]);
const admins = new Map(
  new TextDecoder()
    .decode(adminBytes)
    .trim()
    .split('\n')
    .map((line) => {
      const f = line.split('\t');
      return [f[0]!, f[1]!];
    }),
);
const bytes = unzipSync(zip)['cities500.txt'];
if (!bytes) throw new Error('Missing cities500.txt');
const cities = new TextDecoder()
  .decode(bytes)
  .trim()
  .split('\n')
  .map((line) => {
    const f = line.split('\t');
    const aliases = [...new Set([f[1]!, f[2]!, ...f[3]!.split(',')])].filter(Boolean);
    return {
      name: f[1]!,
      aliases,
      country: f[8]!,
      admin: admins.get(`${f[8]}.${f[10]}`) ?? f[10]!,
      lat: Number(f[4]),
      lng: Number(f[5]),
      tz: f[17]!,
      population: Number(f[14]),
    };
  })
  .filter((c) => c.tz && Number.isFinite(c.lat) && Number.isFinite(c.lng));
const dir = new URL('../apps/web/resources/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('cities500.json.gz', dir), gzipSync(JSON.stringify(cities), { level: 9 }));
await writeFile(
  new URL('geonames-license.txt', dir),
  'GeoNames cities500 and admin1CodesASCII — CC BY 4.0\nhttps://www.geonames.org/\nhttps://creativecommons.org/licenses/by/4.0/\nGenerated from https://download.geonames.org/export/dump/\n',
);
console.log(
  `Prepared ${cities.length} cities with names, aliases, coordinates and IANA timezones.`,
);
