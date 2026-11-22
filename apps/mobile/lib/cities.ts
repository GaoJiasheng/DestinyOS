import { z } from 'zod';
import { DecodeUTF8, Gunzip } from 'fflate';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import cityAsset from '../assets/cities/cities.bin';
import { foldPairs, traditionalPairs } from './hanzi-variants';
const CitySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  country: z.string(),
  admin: z.string(),
  lat: z.number(),
  lng: z.number(),
  tz: z.string(),
  population: z.number(),
});
export type City = z.infer<typeof CitySchema>;
let cityPromise: Promise<City[]> | undefined;
// DESIGN-GAP: The ~12MB decoded list used to be inflated, parsed and validated in one synchronous
// block (~2s on a simulator). That froze the JS thread right as step two of the birth form
// mounted, so touches, typing and native layout state (the safe-area inset) were applied late and
// the page jumped under the user's finger. The work now runs in slices that yield between them.
const inflateSlice = 64 * 1024;
const validateSlice = 4000;
const CityList = z.array(CitySchema);
/** Give queued touches, typing and native state updates a turn between slices of work. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function inflate(bytes: Uint8Array): Promise<string> {
  const parts: string[] = [];
  const decoder = new DecodeUTF8((part) => parts.push(part));
  const gunzip = new Gunzip((chunk, final) => decoder.push(chunk, final));
  for (let offset = 0; offset < bytes.length; offset += inflateSlice) {
    const end = Math.min(offset + inflateSlice, bytes.length);
    gunzip.push(bytes.subarray(offset, end), end === bytes.length);
    await yieldToUi();
  }
  return parts.join('');
}
async function validate(raw: unknown): Promise<City[]> {
  if (!Array.isArray(raw)) return CityList.parse(raw);
  const cities: City[] = [];
  for (let start = 0; start < raw.length; start += validateSlice) {
    for (const city of CityList.parse(raw.slice(start, start + validateSlice))) cities.push(city);
    await yieldToUi();
  }
  return cities;
}
/** Load the bundled, attributed GeoNames subset without a geo API or location permission.
 * Safe to call early (the birth form starts it on step one); every caller shares one load. */
export function loadCities(): Promise<City[]> {
  cityPromise ??= (async () => {
    const asset = Asset.fromModule(cityAsset);
    await asset.downloadAsync();
    const text = await inflate(await new File(asset.localUri ?? asset.uri).bytes());
    const cities = await validate(JSON.parse(text));
    await buildIndex(cities);
    return cities;
  })().catch((error: unknown) => {
    cityPromise = undefined;
    throw error;
  });
  return cityPromise;
}
function pairMap(pairs: string) {
  const chars = Array.from(pairs);
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < chars.length; i += 2) map.set(chars[i]!, chars[i + 1]!);
  return map;
}
const toSimplified = pairMap(foldPairs);
const toTraditional = pairMap(traditionalPairs);
const convert = (value: string, map: Map<string, string>) =>
  Array.from(value, (char) => map.get(char) ?? char).join('');
/** Fold case, accents and traditional/simplified glyphs so either script finds the same city. */
export const normalizeCityName = (value: string) =>
  convert(
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('en'),
    toSimplified,
  );
const han = /^[\u3400-\u9fff]+$/u;
/** Chinese label for the UI locale when the data carries one; English otherwise. */
export function cityLabel(city: City, locale: string): string {
  if (locale === 'en') return city.name;
  const alias = city.aliases.find((name) => han.test(name));
  if (!alias) return city.name;
  return locale === 'zh-TW' ? convert(alias, toTraditional) : convert(alias, toSimplified);
}
// Normalizing ~78k cities' aliases per keystroke cost ~20 ms in node; build the index once per list.
const indexes = new WeakMap<readonly City[], string[][]>();
const indexEntry = (city: City) => [
  ...new Set(city.aliases.concat(city.name).map(normalizeCityName)),
];
function indexOf(cities: readonly City[]) {
  let index = indexes.get(cities);
  if (!index) {
    index = cities.map(indexEntry);
    indexes.set(cities, index);
  }
  return index;
}
/** Build the search index ahead of the first keystroke, in slices, so typing never waits on it. */
async function buildIndex(cities: readonly City[]) {
  if (indexes.has(cities)) return;
  const index: string[][] = [];
  for (let start = 0; start < cities.length; start += validateSlice) {
    for (const city of cities.slice(start, start + validateSlice)) index.push(indexEntry(city));
    await yieldToUi();
  }
  indexes.set(cities, index);
}
// DESIGN-GAP: GeoNames carries no everyday abbreviations, so a few common ones typed as the whole
// query put that city first; the ordinary matches follow, so "la" still lists Lagos and La Paz
// (audit 2.4: "nyc" found nothing).
const shorthands: Readonly<Record<string, string>> = {
  nyc: 'new york city',
  la: 'los angeles',
  sf: 'san francisco',
  dc: 'washington',
  hk: 'hong kong',
  kl: 'kuala lumpur',
};
/** Exact > prefix > substring; population breaks ties, with bounded native autocomplete results. */
export function searchCities(cities: readonly City[], query: string): City[] {
  const term = normalizeCityName(query);
  const expanded = shorthands[term];
  const matches = rankCities(cities, term);
  if (!expanded) return matches;
  const first = rankCities(cities, expanded)[0];
  return first ? [first, ...matches.filter((city) => city !== first)].slice(0, 12) : matches;
}
function rankCities(cities: readonly City[], term: string): City[] {
  if (!term) return [];
  const index = indexOf(cities);
  const hits: { city: City; rank: number }[] = [];
  cities.forEach((city, i) => {
    let rank = 0;
    for (const name of index[i]!) {
      if (name === term) rank = 3;
      else if (rank < 2 && name.startsWith(term)) rank = 2;
      else if (rank < 1 && name.includes(term)) rank = 1;
      if (rank === 3) break;
    }
    if (rank) hits.push({ city, rank });
  });
  return hits
    .sort((a, b) => b.rank - a.rank || b.city.population - a.city.population)
    .slice(0, 12)
    .map(({ city }) => city);
}
