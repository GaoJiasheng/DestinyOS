import { it, expect } from 'vitest';
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
