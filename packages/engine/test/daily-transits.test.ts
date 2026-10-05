import { Temporal } from '@js-temporal/polyfill';
import { type AstroChart } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { dailyAstro, findDailyTransits, type Position } from '../src';
import { astro, position } from './daily-fixtures';

describe('daily western-specific transit limits, ingress, lunations and retrogrades', () => {
  const target = (lon: number, noonChart = false): AstroChart => ({
    ...astro,
    noonChart,
    bodies: [{ ...astro.bodies[0]!, key: 'sun', lon }],
    angles: null,
  });
  const positions = (body: string, lon: number, speed = 1) =>
    Object.fromEntries(
      ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((key) => [
        key,
        position(key === body ? lon : 17.3, speed),
      ]),
    ) as Record<'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn', Position>;
  it.each([
    ['moon', 3, true],
    ['moon', 3.001, false],
    ['sun', 1.5, true],
    ['sun', 1.501, false],
    ['jupiter', 1, true],
    ['jupiter', 1.001, false],
    ['saturn', 1, true],
  ] as const)('uses %s orb %s inclusive=%s', (body, orb, expected) =>
    expect(
      findDailyTransits(positions(body, orb), target(0)).some((hit) => hit.transiting === body),
    ).toBe(expected),
  );
  it('handles all major aspects, applying/separating and wraparound without luminary bonus', () => {
    for (const angle of [0, 60, 90, 120, 180]) {
      const hits = findDailyTransits(positions('sun', angle + 0.5, -1), target(0));
      expect(hits[0]?.orb).toBeCloseTo(0.5);
      expect(hits[0]?.applying).toBe(true);
    }
    expect(findDailyTransits(positions('sun', 359.5, 1), target(0))[0]?.applying).toBe(true);
    expect(findDailyTransits(positions('sun', 0.5, 1), target(0))[0]?.applying).toBe(false);
    expect(findDailyTransits(positions('sun', 0, 0), target(0))[0]?.applying).toBe(false);
    expect(findDailyTransits(positions('sun', 0), null)).toEqual([]);
  });
  it('sorts/caps three tightest aspects, excludes slow→MC/Venus, and omits unknown-time targets', () => {
    const custom: AstroChart = {
      ...astro,
      bodies: [{ ...astro.bodies[0]!, key: 'venus', lon: 0 }],
      angles: { asc: 1.8, mc: 0, dsc: 181.8, ic: 180 },
    };
    const p = positions('sun', 0);
    p.moon = position(0.2);
    p.mercury = position(0.3);
    p.jupiter = position(0);
    p.saturn = position(0);
    const hits = findDailyTransits(p, custom);
    expect(hits).toHaveLength(3);
    expect(hits.map((t) => t.orb)).toEqual([0, 0, 0.19999999999998863]);
    expect(hits.every((t) => !['jupiter', 'saturn'].includes(t.transiting))).toBe(true);
    expect(findDailyTransits(p, { ...custom, noonChart: true })).toEqual([]);
    expect(findDailyTransits(p, custom, true)).toEqual([]);
  });
  it('detects ingress within the local civil day and real new/full-moon events rather than a phase bin', () => {
    const ingress = dailyAstro('2026-10-05', 'Asia/Shanghai', null, false);
    expect(ingress.moonChangesSign).toBe(true);
    expect(ingress.moonIngress?.sign).toBe('leo');
    expect(
      Temporal.Instant.from(ingress.moonIngress!.at).toZonedDateTimeISO('Asia/Shanghai').day,
    ).toBe(5);
    const newMoon = dailyAstro('2026-10-10', 'Asia/Shanghai', null, false);
    expect(newMoon.lunation).toBe('new_moon');
    expect(dailyAstro('2026-10-26', 'Asia/Shanghai', null, false).lunation).toBe('full_moon');
    expect(dailyAstro('2026-10-11', 'Asia/Shanghai', null, false).lunation).toBeNull();
    expect(dailyAstro('2026-11-01', 'America/New_York', null, false).retrogrades).toContain(
      'mercury',
    );
  });
});
