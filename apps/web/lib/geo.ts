import { localeText } from '@tianji/shared/locale';
import { resourceBytes } from './platform/resources';
import { gunzipSync } from 'node:zlib';
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
export type City = z.infer<typeof citySchema>;
let corpus: Promise<Array<City & { search: string[] }>> | undefined;
const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
/** Search only the bundled GeoNames corpus; no birth-location queries leave our server. */
export async function searchCities(query: string, locale: 'zh' | 'en' | 'zh-TW') {
  corpus ??= resourceBytes('resources/cities500.json.gz').then((data) =>
    z
      .array(citySchema)
      .parse(JSON.parse(gunzipSync(data).toString()))
      .map((c) => ({ ...c, search: c.aliases.map(fold) })),
  );
  const q = fold(query);
  if (!q) return [];
  return (await corpus)
    .map((c) => ({
      c,
      rank: c.search.some((s) => s === q)
        ? 0
        : c.search.some((s) => s.startsWith(q))
          ? 1
          : c.search.some((s) => s.includes(q))
            ? 2
            : 3,
    }))
    .filter((r) => r.rank < 3)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.c.population - a.c.population ||
        a.c.name.localeCompare(b.c.name, 'en'),
    )
    .slice(0, 12)
    .map(({ c }) => ({
      name: localeText(
        locale !== 'en'
          ? (c.aliases.find((a) => /^[\p{Script=Han}]+$/u.test(a)) ?? c.name)
          : c.name,
        locale,
      ),
      country: c.country,
      admin: c.admin,
      lat: c.lat,
      lng: c.lng,
      tz: c.tz,
    }));
}
