import { z } from 'zod';
import { gunzipSync, strFromU8 } from 'fflate';
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
/** Load the bundled, attributed GeoNames subset without a geo API or location permission. */
export function loadCities(): Promise<City[]> {
  cityPromise ??= (async () => {
    const asset = Asset.fromModule(cityAsset);
    await asset.downloadAsync();
    return z
      .array(CitySchema)
      .parse(
        JSON.parse(strFromU8(gunzipSync(await new File(asset.localUri ?? asset.uri).bytes()))),
      );
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
function indexOf(cities: readonly City[]) {
  let index = indexes.get(cities);
  if (!index) {
    index = cities.map((city) => [
      ...new Set(city.aliases.concat(city.name).map(normalizeCityName)),
    ]);
    indexes.set(cities, index);
  }
  return index;
}
/** Exact > prefix > substring; population breaks ties, with bounded native autocomplete results. */
export function searchCities(cities: readonly City[], query: string): City[] {
  const term = normalizeCityName(query);
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
