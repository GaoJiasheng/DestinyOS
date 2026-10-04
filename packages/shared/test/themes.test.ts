import { describe, expect, it } from 'vitest';
import { routeTheme } from '../../../apps/web/lib/themes';
import { brand } from '../src/brand';
import { System, Gender, Plan, ReadingStatus, HouseSystem } from '../src/enums';
describe('documented shared contracts', () => {
  it('keeps canonical brand configuration', () =>
    expect(brand).toMatchObject({
      nameZh: '天机',
      nameEn: 'DestinyOS',
      domain: 'tianji.gavin.pub',
    }));
  it('keeps documented model values', () => {
    expect(Object.values(System)).toEqual([
      'bazi',
      'ziwei',
      'iching',
      'qimen',
      'tarot',
      'astrology',
      'vedic',
      'daily',
    ]);
    expect(Object.values(Gender)).toEqual(['male', 'female', 'unspecified']);
    expect(Object.values(Plan)).toEqual(['free', 'pro']);
    expect(Object.values(ReadingStatus)).toEqual(['ok', 'failed']);
    expect(HouseSystem.whole_sign).toBe('whole_sign');
  });
  it.each(['bazi', 'ziwei', 'iching', 'qimen'])('selects east for %s', (system) =>
    expect(routeTheme(`/zh/${system}/new`)).toBe('east'),
  );
  it.each(['tarot', 'astrology'])('selects west for %s', (system) =>
    expect(routeTheme(`/en/${system}`)).toBe('west'),
  );
  it('selects vedic and neutral routes and honors a lock', () => {
    expect(routeTheme('/zh/vedic')).toBe('vedic');
    expect(routeTheme('/zh/today')).toBe('neutral');
    expect(routeTheme('/en/vedic', 'east')).toBe('east');
    expect(routeTheme('/zh/unknown')).toBe('neutral');
  });
});
