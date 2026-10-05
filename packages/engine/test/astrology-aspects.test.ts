import { Aspect, type Body } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { ASPECT_ANGLES, aspectPatterns, aspects, DEFAULT_ORBS } from '../src';
import { pos } from './astrology-fixtures';

describe('all nine aspects and inclusive orb boundaries', () => {
  it.each(Object.values(Aspect))('%s matches exact and both orb edges; rejects outside', (type) => {
    const target = ASPECT_ANGLES[type],
      orb = DEFAULT_ORBS[type];
    for (const lon of [target, target + orb, target - orb].filter((x) => x >= 0 && x <= 180))
      expect(aspects({ mercury: pos(0, 0), venus: pos(lon) }).some((a) => a.type === type)).toBe(
        true,
      );
    const lon = target === 180 ? target - orb - 0.0001 : target + orb + 0.0001;
    expect(aspects({ mercury: pos(0, 0), venus: pos(lon) }).some((a) => a.type === type)).toBe(
      false,
    );
  });
  it('adds the luminary bonus once, permits custom orbs and assigns major flags', () => {
    expect(
      aspects({ sun: pos(0), moon: pos(10) }).find((a) => a.type === 'conjunction'),
    ).toBeDefined();
    expect(
      aspects({ sun: pos(0), moon: pos(10.001) }).find((a) => a.type === 'conjunction'),
    ).toBeUndefined();
    expect(aspects({ mercury: pos(0), venus: pos(3) }, { conjunction: 2 })).toEqual([]);
    expect(aspects({ mercury: pos(0), venus: pos(30) })[0]?.major).toBe(false);
    expect(aspects({ mercury: pos(0), venus: pos(60) })[0]?.major).toBe(true);
  });
  it.each([
    [0, 91, -1, true],
    [0, 91, 1, false],
    [359, 1, -1, true],
    [359, 1, 1, false],
    [0, 179, 1, true],
    [0, 179, -1, false],
    [0, 90, 1, false],
    [0, 91, 0, false],
  ])('signed applying at %s / %s with relative velocity %s', (a, b, speed, expected) => {
    expect(
      aspects({ mercury: pos(a as number, 0), venus: pos(b as number, speed as number) })[0]
        ?.applying,
    ).toBe(expected);
  });
  it.each([
    ['grand_trine', [0, 120, 240]],
    ['t_square', [0, 90, 180]],
    ['grand_cross', [0, 90, 180, 270]],
    ['kite', [0, 120, 240, 180]],
    ['yod', [0, 60, 210]],
  ] as const)('detects and deduplicates %s', (key, lons) => {
    const keys: Body[] = ['mercury', 'venus', 'mars', 'jupiter'],
      p: Partial<Record<Body, ReturnType<typeof pos>>> = {};
    lons.forEach((lon, i) => {
      p[keys[i]!] = pos(lon);
    });
    const patterns = aspectPatterns(aspects(p)).filter((x) => x.key === key);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.bodies).toHaveLength(lons.length);
    expect(aspectPatterns(aspects({ mercury: pos(0), venus: pos(10), mars: pos(20) }))).toEqual([]);
  });
});
