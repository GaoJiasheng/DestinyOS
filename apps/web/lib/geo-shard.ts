// DESIGN-GAP: The full GeoNames corpus (236k cities, ~53MB JSON) needs >200MB once parsed and exceeded the 128MB Workers isolate limit on every search. The build splits it into prefix shards (scripts/geo-shards.ts) so a request reads one small file.
export const GEO_SHARD_COUNT = 512;
export const GEO_SHARD_VERSION = 1;
/** Cities kept for a one-letter query, where the full prefix list would be most of the corpus. */
export const GEO_SINGLE_LETTER_LIMIT = 12;

/** [name, Han alias or '', country, admin, lat, lng, tz, population] */
export type ShardCity = [string, string, string, string, number, number, string, number];
/** [folded alias, city index, 1 when the alias only matches from a later word] */
export type ShardAlias = [string, number] | [string, number, 1];
export type ShardGroup = { c: ShardCity[]; a: ShardAlias[] };
export type Shard = Record<string, ShardGroup>;

/** Case-, width- and accent-insensitive form shared by the index and queries. */
export const fold = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

const ideographic = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Index key of a folded string: one CJK character, otherwise the first two characters. */
export function geoKey(folded: string): string {
  const chars = Array.from(folded);
  const first = chars[0];
  if (first === undefined) return '';
  return ideographic.test(first) ? first : chars.slice(0, 2).join('');
}

/** Stable FNV-1a bucket for an index key. */
export function geoShard(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % GEO_SHARD_COUNT;
}

/** Resource path of a shard relative to the web app root. */
export const geoShardPath = (shard: number) =>
  `resources/geo/${shard.toString(16).padStart(3, '0')}.json`;
