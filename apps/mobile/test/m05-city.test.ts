import { loadCities, searchCities } from '../lib/cities';
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
