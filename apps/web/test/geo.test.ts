import { it, expect, vi } from 'vitest';
import { GET as timezone } from '../app/api/v1/geo/tz/route';
import { searchCities } from '../lib/geo';
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
