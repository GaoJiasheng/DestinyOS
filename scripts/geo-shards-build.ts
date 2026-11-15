import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';
import {
  GEO_SHARD_COUNT,
  GEO_SHARD_VERSION,
  GEO_SINGLE_LETTER_LIMIT,
  fold,
  geoKey,
  geoShard,
  geoShardPath,
  type Shard,
  type ShardAlias,
  type ShardCity,
} from '../apps/web/lib/geo-shard';

const web = resolve(import.meta.dirname, '../apps/web');
const source = resolve(web, 'resources/cities500.json.gz');
const meta = resolve(web, 'resources/geo/_meta.json');
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
type Group = { cities: Map<number, number>; c: ShardCity[]; a: ShardAlias[]; seen: Set<string> };

/** Split the GeoNames corpus into prefix shards; a matching source hash makes the call a no-op. */
export async function buildGeoShards(): Promise<{ built: boolean; bytes: number }> {
  const gz = await readFile(source);
  const stamp = JSON.stringify({
    version: GEO_SHARD_VERSION,
    shards: GEO_SHARD_COUNT,
    source: createHash('sha256').update(gz).digest('hex'),
  });
  if ((await readFile(meta, 'utf8').catch(() => '')) === stamp) return { built: false, bytes: 0 };
  const cities = z.array(citySchema).parse(JSON.parse(gunzipSync(gz).toString()));
  const groups = new Map<string, Group>();
  const add = (key: string, index: number, alias: string, later: boolean) => {
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { cities: new Map(), c: [], a: [], seen: new Set() }));
    let local = group.cities.get(index);
    if (local === undefined) {
      const city = cities[index]!;
      local = group.c.length;
      group.cities.set(index, local);
      group.c.push([
        city.name,
        city.aliases.find((name) => /^[\p{Script=Han}]+$/u.test(name)) ?? '',
        city.country,
        city.admin,
        city.lat,
        city.lng,
        city.tz,
        city.population,
      ]);
    }
    const id = `${local}\u0000${alias}`;
    if (group.seen.has(id)) return;
    group.seen.add(id);
    group.a.push(later ? [alias, local, 1] : [alias, local]);
  };
  // One-letter queries cannot use a two-character key; keep only the largest cities per letter.
  const letters = new Map<string, Array<{ index: number; alias: string }>>();
  cities.forEach((city, index) => {
    const folded = new Set(city.aliases.map(fold).filter(Boolean));
    const initials = new Set<string>();
    for (const alias of folded) {
      const key = geoKey(alias);
      add(key, index, alias, false);
      const first = Array.from(alias)[0]!;
      if (key !== first && !initials.has(first)) {
        initials.add(first);
        const list = letters.get(first) ?? [];
        letters.set(first, list);
        list.push({ index, alias });
      }
    }
    // "york" should still find "new york": index every later word as a lower-ranked entry, after the direct aliases so an exact alias is never recorded as a later-word match.
    for (const alias of folded) {
      const words = alias.split(/[\s\-/,.()]+/u).filter(Boolean);
      for (let word = 1; word < words.length && word <= 3; word++) {
        const rest = words.slice(word).join(' ');
        if (Array.from(rest).length >= 3) add(geoKey(rest), index, rest, true);
      }
    }
  });
  for (const [letter, list] of letters) {
    const top = list
      .sort(
        (a, b) =>
          cities[b.index]!.population - cities[a.index]!.population ||
          a.alias.localeCompare(b.alias, 'en'),
      )
      .slice(0, GEO_SINGLE_LETTER_LIMIT);
    for (const { index, alias } of top) add(letter, index, alias, false);
  }
  const shards: Shard[] = Array.from({ length: GEO_SHARD_COUNT }, () => ({}));
  for (const [key, group] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1)))
    shards[geoShard(key)]![key] = { c: group.c, a: group.a };
  await rm(resolve(web, 'resources/geo'), { recursive: true, force: true });
  await mkdir(resolve(web, 'resources/geo'), { recursive: true });
  let bytes = 0;
  await Promise.all(
    shards.map(async (shard, index) => {
      const text = JSON.stringify(shard);
      bytes += Buffer.byteLength(text);
      await writeFile(resolve(web, geoShardPath(index)), text);
    }),
  );
  await writeFile(meta, stamp);
  return { built: true, bytes };
}
