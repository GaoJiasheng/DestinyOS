import { z } from 'zod';
import { gunzipSync, strFromU8 } from 'fflate';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import cityAsset from '../assets/cities/cities.bin';
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
const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('en');
/** Prefix matches rank first; population breaks ties, with bounded native autocomplete results. */
export function searchCities(cities: readonly City[], query: string): City[] {
  const term = normalize(query);
  if (!term) return [];
  return cities
    .map((city) => ({ city, names: city.aliases.map(normalize) }))
    .filter(({ names }) => names.some((name) => name.includes(term)))
    .sort(
      (a, b) =>
        Number(b.names.some((name) => name.startsWith(term))) -
          Number(a.names.some((name) => name.startsWith(term))) ||
        b.city.population - a.city.population,
    )
    .slice(0, 12)
    .map(({ city }) => city);
}
