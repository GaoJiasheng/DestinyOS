import { Temporal } from '@js-temporal/polyfill';
import { expect } from 'vitest';
import { distance, normalizeBirth } from '../src';
import A from './fixtures/birth/A.json';
/** Shared astrology fixture setup for the split regression suites. */
export const birth = normalizeBirth(A),
  now = '2026-10-04T00:00:00Z';
/** Build an zero-latitude position fixture.
 * @param lon Tropical longitude in degrees.
 * @param speed Angular speed in degrees per day. */
export const pos = (lon: number, speed = 1) => ({ lon, lat: 0, speed, retrograde: speed < 0 });
/** Convert a fixed UTC instant to a UT Julian day.
 * @param iso ISO 8601 instant with explicit offset. */
export const jd = (iso: string) =>
  Temporal.Instant.from(iso).epochMilliseconds / 86400000 + 2440587.5;
/** Assert inclusive circular angular distance at a reference tolerance.
 * @param actual Actual angle in degrees.
 * @param expected Reference angle in degrees.
 * @param tolerance Maximum angular distance in degrees. */
export const close = (actual: number, expected: number, tolerance: number) =>
  expect(distance(actual, expected)).toBeLessThanOrEqual(tolerance);
