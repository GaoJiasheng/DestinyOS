import { beforeAll, it, expect, vi } from 'vitest';
import { GET as timezone } from '../app/api/v1/geo/tz/route';
import { searchCities } from '../lib/geo';
import { buildGeoShards } from '../../../scripts/geo-shards-build';

// Shards are a build artifact (gitignored); a current set makes this a hash check.
beforeAll(async () => {
  await buildGeoShards();
}, 120_000);
it('searches real GeoNames aliases for Beijing, New York and Sydney', async () => {
  for (const q of ['北京', 'Beijing', 'New York', '悉尼']) {
    const cities = await searchCities(q, q === 'Beijing' || q === 'New York' ? 'en' : 'zh');
    expect(cities.length).toBeGreaterThan(0);
    expect(cities[0]?.tz).toBe(
      q === 'New York' ? 'America/New_York' : q === '悉尼' ? 'Australia/Sydney' : 'Asia/Shanghai',
    );
    expect(cities.length).toBeLessThanOrEqual(12);
  }
});

it('ranks exact names first, matches later words and keeps one-letter queries small', async () => {
  const names = async (q: string, locale: 'zh' | 'en' = 'en') =>
    (await searchCities(q, locale)).map((city) => city.name);
  expect((await names('london'))[0]).toBe('London');
  // Villages literally named "Tok" must not push the city people are typing out of first place.
  expect((await names('Tok'))[0]).toBe('Tokyo');
  expect((await names('bath'))[0]).toBe('Bath');
  expect(await names('york')).toContain('New York City');
  expect((await names('上海', 'zh'))[0]).toBe('上海');
  expect((await names('são paulo'))[0]).toBe('São Paulo');
  expect((await names('sao pau'))[0]).toBe('São Paulo');
  const single = await names('s');
  expect(single.length).toBeGreaterThan(0);
  expect(single.length).toBeLessThanOrEqual(12);
  expect(await names('zzzzqqq')).toEqual([]);
  expect(await names('__proto__')).toEqual([]);
});

it('puts the city behind a common abbreviation first and keeps the ordinary matches after it', async () => {
  const search = (q: string) => searchCities(q, 'en');
  expect((await search('NYC'))[0]?.tz).toBe('America/New_York');
  expect((await search('sf'))[0]?.name).toBe('San Francisco');
  expect((await search('DC'))[0]?.admin).toBe('District of Columbia');
  const la = await search('la');
  expect(la[0]?.name).toBe('Los Angeles');
  expect(la.length).toBeGreaterThan(1);
  expect(la.length).toBeLessThanOrEqual(12);
  expect(new Set(la.map((city) => `${city.name}${city.lat}${city.lng}`)).size).toBe(la.length);
});

it('keeps every shard small enough for a 128MB Workers isolate', async () => {
  const { readdir, stat } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const { webDirectory } = await import('../lib/platform/resources-node');
  const directory = resolve(webDirectory(), 'resources/geo');
  const sizes = await Promise.all(
    (await readdir(directory)).map(async (name) => (await stat(resolve(directory, name))).size),
  );
  expect(sizes.length).toBe(513);
  expect(Math.max(...sizes)).toBeLessThan(4 * 1024 * 1024);
});

it('rejects empty/nonfinite coordinates and treats URLs/traversal as inert city search text', async () => {
  for (const query of ['lat=&lng=', 'lat=NaN&lng=0', 'lat=0&lng=Infinity', 'lat=91&lng=0'])
    expect(
      (await timezone(new Request(`https://example.test/api/v1/geo/tz?${query}`))).status,
    ).toBe(400);
  const fetch = vi.spyOn(globalThis, 'fetch');
  try {
    for (const q of [
      '../../etc/passwd',
      'http://169.254.169.254/latest/meta-data',
      'file:///etc/passwd',
    ])
      expect(await searchCities(q, 'en')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
