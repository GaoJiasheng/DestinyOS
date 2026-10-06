import { URL } from 'node:url';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { z } from 'zod';
const citySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  country: z.string(),
  admin: z.string(),
  lat: z.number(),
  lng: z.number(),
  tz: z.string(),
  population: z.number(),
});
const source = new URL('../../web/resources/cities500.json.gz', import.meta.url);
const cities = z.array(citySchema).parse(JSON.parse(gunzipSync(await readFile(source)).toString()));
// DESIGN-GAP: The ~3MB native subset keeps cities with >=4000 residents and up to eight
// Chinese aliases; GeoNames canonical names retain worldwide English/romanized search.
const subset = cities
  .filter((city) => city.population >= 4000)
  .map((city) => ({
    ...city,
    aliases: [
      ...new Set([city.name, ...city.aliases.filter((alias) => /[\u3400-\u9fff]/u.test(alias))]),
    ].slice(0, 8),
  }))
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, 'en'));
const bytes = gzipSync(JSON.stringify(subset), { level: 9 });
const directory = new URL('../assets/cities/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('cities.bin', directory), bytes);
await copyFile(
  new URL('../../web/resources/geonames-license.txt', import.meta.url),
  new URL('geonames-license.txt', directory),
);
await writeFile(
  new URL('manifest.json', directory),
  JSON.stringify(
    {
      records: subset.length,
      compressedBytes: bytes.length,
      minimumPopulation: 4000,
      source: 'GeoNames cities500',
      license: 'CC BY 4.0',
    },
    null,
    2,
  ) + '\n',
);
console.log(`${subset.length} offline cities, ${bytes.length} compressed bytes`);
