import { describe, expect, it } from 'vitest';
import { nakshatraAt, navamsaSign, vimshottari } from '../src';

describe('exact division boundaries and mutual reception', () => {
  it.each(Array.from({ length: 108 }, (_, i) => i))(
    'D9/Pada boundary %s belongs to the following division',
    (i) => {
      const lon = (i * 10) / 3,
        signs = [
          'aries',
          'taurus',
          'gemini',
          'cancer',
          'leo',
          'virgo',
          'libra',
          'scorpio',
          'sagittarius',
          'capricorn',
          'aquarius',
          'pisces',
        ];
      expect(navamsaSign(lon)).toBe(signs[i % 12]);
      expect(navamsaSign(lon + 1e-8)).toBe(signs[i % 12]);
      expect(navamsaSign(lon - 1e-8)).toBe(signs[(i + 11) % 12]);
      expect(nakshatraAt(lon).index).toBe(Math.floor(i / 4));
      expect(nakshatraAt(lon).pada).toBe((i % 4) + 1);
      if (i % 4 === 0) {
        const d = vimshottari(2451545, lon, 2451545);
        expect(d.sequence[0]!.antar[0]!.lord).toBe(nakshatraAt(lon).lord);
        expect(d.sequence[0]!.from).toBe('2000-01-01T12:00:00.000Z');
      }
    },
  );
});
