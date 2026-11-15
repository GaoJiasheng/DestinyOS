import { localeText } from '@tianji/shared/locale';
import { resourceText } from './platform/resources';
import {
  fold,
  geoKey,
  geoShard,
  geoShardPath,
  type Shard,
  type ShardAlias,
  type ShardCity,
  type ShardGroup,
} from './geo-shard';

export type City = {
  name: string;
  country: string;
  admin: string;
  lat: number;
  lng: number;
  tz: string;
};
// Typing extends the same prefix, so consecutive requests hit one shard; four parsed shards stay well under 20MB.
const CACHE_LIMIT = 4;
const cache = new Map<number, Promise<Shard>>();

function loadShard(index: number): Promise<Shard> {
  const cached = cache.get(index);
  if (cached) {
    cache.delete(index);
    cache.set(index, cached);
    return cached;
  }
  const pending = resourceText(geoShardPath(index))
    .then((text) => JSON.parse(text) as Shard)
    .catch((error: unknown) => {
      // A failed Assets read must not poison later searches.
      cache.delete(index);
      throw error;
    });
  cache.set(index, pending);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return pending;
}

const isCity = (value: unknown): value is ShardCity =>
  Array.isArray(value) &&
  value.length === 8 &&
  [0, 1, 2, 3, 6].every((index) => typeof value[index] === 'string') &&
  [4, 5, 7].every((index) => Number.isFinite(value[index]));
const isAlias = (value: unknown): value is ShardAlias =>
  Array.isArray(value) && typeof value[0] === 'string' && Number.isInteger(value[1]);

// DESIGN-GAP: Strict "exact alias first, then population" put three villages named Tok/Toc above Tokyo, and foreign-language aliases of megacities above the cities actually called "San …". Matches on a place's own name and exact matches are boosted instead, so size still decides between comparable candidates.
const EXACT_BOOST = 20;
const OWN_NAME_BOOST = 30;

/** Search only the bundled GeoNames corpus; no birth-location queries leave our server. */
export async function searchCities(query: string, locale: 'zh' | 'en' | 'zh-TW'): Promise<City[]> {
  const q = fold(query);
  if (!q) return [];
  const key = geoKey(q);
  const group: ShardGroup | undefined = Object.hasOwn(await loadShard(geoShard(key)), key)
    ? (await loadShard(geoShard(key)))[key]
    : undefined;
  if (!group || !Array.isArray(group.c) || !Array.isArray(group.a)) return [];
  // Per city: later-word matches ("york" → New York) always rank below direct ones; otherwise the best boost wins.
  const matches = new Map<number, { later: boolean; boost: number }>();
  for (const alias of group.a) {
    if (!isAlias(alias) || !alias[0].startsWith(q)) continue;
    const city = group.c[alias[1]];
    if (!isCity(city)) continue;
    const later = alias[2] === 1;
    const own = alias[0] === fold(city[0]) || (city[1] !== '' && alias[0] === fold(city[1]));
    const boost = later ? 1 : (alias[0] === q ? EXACT_BOOST : 1) * (own ? OWN_NAME_BOOST : 1);
    const best = matches.get(alias[1]);
    if (!best || (best.later && !later) || (best.later === later && boost > best.boost))
      matches.set(alias[1], { later, boost });
  }
  return [...matches]
    .map(([index, match]) => ({ city: group.c[index]!, ...match }))
    .sort(
      (a, b) =>
        Number(a.later) - Number(b.later) ||
        b.city[7] * b.boost - a.city[7] * a.boost ||
        b.boost - a.boost ||
        a.city[0].localeCompare(b.city[0], 'en'),
    )
    .slice(0, 12)
    .map(({ city }) => ({
      name: localeText(locale !== 'en' && city[1] ? city[1] : city[0], locale),
      country: city[2],
      admin: city[3],
      lat: city[4],
      lng: city[5],
      tz: city[6],
    }));
}
