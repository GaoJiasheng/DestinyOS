import { cityLabel, loadCities, searchCities } from '../lib/cities';
import manifest from '../assets/cities/manifest.json';
jest.mock('../assets/cities/cities.bin', () => 1);
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => undefined, localUri: 'bundle://cities.bin' }),
  },
}));
jest.mock('expo-file-system', () => ({
  File: class {
    async bytes() {
      return new Uint8Array(
        jest
          .requireActual<typeof import('node:fs')>('node:fs')
          .readFileSync(
            jest
              .requireActual<typeof import('node:path')>('node:path')
              .join(__dirname, '../assets/cities/cities.bin'),
          ),
      );
    }
  },
}));
it('loads an attributed ~3MB offline database and searches Chinese and English without geo APIs', async () => {
  const cities = await loadCities();
  expect(cities.length).toBe(manifest.records);
  expect(manifest.compressedBytes).toBeLessThan(3_500_000);
  expect(manifest.compressedBytes).toBeGreaterThan(2_500_000);
  expect(searchCities(cities, '北京')[0]?.tz).toBe('Asia/Shanghai');
  expect(searchCities(cities, 'Beijing')[0]?.name).toBe('Beijing');
  expect(searchCities(cities, 'New York')[0]?.tz).toBe('America/New_York');
  expect(searchCities(cities, 'Sydney')[0]?.tz).toBe('Australia/Sydney');
  expect(searchCities(cities, 'xxnosuchcityxx')).toEqual([]);
  expect(searchCities(cities, '')).toEqual([]);
  expect(searchCities(cities, 'San').length).toBeLessThanOrEqual(12);
  expect(cities.every((city) => Number.isFinite(city.lat) && Number.isFinite(city.lng))).toBe(true);
});
it('finds cities in either Chinese script, ranks exact names first and shows localized labels', async () => {
  const cities = await loadCities();
  const vancouver = searchCities(cities, '温哥华')[0];
  expect(vancouver?.tz).toBe('America/Vancouver');
  expect(searchCities(cities, '溫哥華')[0]).toBe(vancouver);
  expect(searchCities(cities, '纽约')[0]?.tz).toBe('America/New_York');
  expect(searchCities(cities, 'paris')[0]?.country).toBe('FR');
  expect(cityLabel(vancouver!, 'zh')).toBe('温哥华');
  expect(cityLabel(vancouver!, 'zh-TW')).toBe('溫哥華');
  expect(cityLabel(vancouver!, 'en')).toBe('Vancouver');
  const started = Date.now();
  for (const term of ['b', 'be', 'bei', 'beij']) searchCities(cities, term);
  expect(Date.now() - started).toBeLessThan(1000);
});
it('puts the city behind a common abbreviation first and keeps the ordinary matches after it', async () => {
  const cities = await loadCities();
  expect(searchCities(cities, 'NYC')[0]?.tz).toBe('America/New_York');
  expect(searchCities(cities, 'sf')[0]?.name).toBe('San Francisco');
  expect(searchCities(cities, 'DC')[0]?.admin).toBe('District of Columbia');
  const la = searchCities(cities, 'la');
  expect(la[0]?.name).toBe('Los Angeles');
  expect(la.length).toBeGreaterThan(1);
  expect(la.length).toBeLessThanOrEqual(12);
  expect(new Set(la).size).toBe(la.length);
});
