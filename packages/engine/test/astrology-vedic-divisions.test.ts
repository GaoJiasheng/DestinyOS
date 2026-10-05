import { describe, expect, it } from 'vitest';
import { ayanamsaLahiri, combust, dignity, nakshatraAt, navamsaSign } from '../src';
import { birth, close } from './astrology-fixtures';

describe('Vedic sidereal divisions, dignity and combustion', () => {
  it('Lahiri 2000-01-01 is 23°51′ within 1′ and 1990 is about 23°43′', () => {
    close(ayanamsaLahiri(2451544.5), 23 + 51 / 60, 1 / 60);
    close(ayanamsaLahiri(birth.jd!), 23 + 43 / 60, 1 / 60);
  });
  it.each(Array.from({ length: 27 }, (_, i) => i))(
    'Nakshatra %s has four padas and a repeating lord',
    (index) => {
      for (let pada = 1; pada <= 4; pada++) {
        const lon = (index * 40) / 3 + ((pada - 0.5) * 10) / 3,
          n = nakshatraAt(lon);
        expect(n.index).toBe(index);
        expect(n.pada).toBe(pada);
        expect(n.lord).toBe(
          ['ketu', 'shukra', 'surya', 'chandra', 'mangala', 'rahu', 'guru', 'shani', 'budha'][
            index % 9
          ],
        );
      }
    },
  );
  it.each([
    ['aries', 0],
    ['capricorn', 30],
    ['libra', 60],
    ['cancer', 90],
  ] as const)('D9 starts at %s for longitude %s', (sign, lon) => {
    expect(navamsaSign(lon)).toBe(sign);
    expect(navamsaSign(lon + 3.4)).not.toBe(sign);
    expect(navamsaSign(lon + 360)).toBe(sign);
  });
  it.each([
    ['surya', 10, 'exalted'],
    ['surya', 190, 'debilitated'],
    ['surya', 125, 'moolatrikona'],
    ['surya', 145, 'own'],
    ['chandra', 31, 'exalted'],
    ['chandra', 35, 'moolatrikona'],
    ['chandra', 95, 'own'],
    ['chandra', 215, 'debilitated'],
    ['mangala', 275, 'exalted'],
    ['mangala', 5, 'moolatrikona'],
    ['mangala', 15, 'own'],
    ['mangala', 95, 'debilitated'],
    ['budha', 155, 'exalted'],
    ['budha', 167, 'moolatrikona'],
    ['budha', 175, 'own'],
    ['budha', 335, 'debilitated'],
    ['guru', 95, 'exalted'],
    ['guru', 245, 'moolatrikona'],
    ['guru', 255, 'own'],
    ['guru', 275, 'debilitated'],
    ['shukra', 335, 'exalted'],
    ['shukra', 185, 'moolatrikona'],
    ['shukra', 205, 'own'],
    ['shukra', 155, 'debilitated'],
    ['shani', 185, 'exalted'],
    ['shani', 305, 'moolatrikona'],
    ['shani', 325, 'own'],
    ['shani', 5, 'debilitated'],
    ['surya', 35, 'enemy'],
    ['surya', 65, 'neutral'],
    ['surya', 95, 'friend'],
    ['rahu', 35, 'neutral'],
    ['ketu', 155, 'neutral'],
  ] as const)('%s at %s° is %s', (body, lon, expected) =>
    expect(dignity(body, lon)).toBe(expected),
  );
  it.each([
    ['chandra', 12, false],
    ['mangala', 17, false],
    ['budha', 14, false],
    ['budha', 12, true],
    ['guru', 11, false],
    ['shukra', 10, false],
    ['shukra', 8, true],
    ['shani', 15, false],
  ] as const)('%s combustion threshold %s retro %s', (body, limit, retro) => {
    expect(combust(body, limit - 0.001, 0, retro)).toBe(true);
    expect(combust(body, limit, 0, retro)).toBe(false);
    expect(combust(body, 360 - limit + 0.001, 0, retro)).toBe(true);
  });
  it('Sun and nodes are never combust', () => {
    for (const body of ['surya', 'rahu', 'ketu'] as const)
      expect(combust(body, 0, 0, false)).toBe(false);
  });
});
