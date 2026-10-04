import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeStars, equatorialPoint } from '../lib/star-catalog';
import { FrameMonitor } from '../lib/three-policy';
import { zenithAt, planetsAt } from '../components/three/sky-position';
import { computeHomeInsights } from '../lib/home-insights';
import { baziReading } from './fixtures/bazi-reading';
describe('real sky and home previews', () => {
  it('contains all 9096 stars and correct J2000 Sirius coordinates', () => {
    const bytes = readFileSync(new URL('../public/stars.bin', import.meta.url));
    const stars = decodeStars(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    expect(stars).toHaveLength(9096);
    const sirius = stars.find((s) => s.mag < -1)!;
    expect(sirius.ra).toBeCloseTo(101.287, 2);
    expect(sirius.dec).toBeCloseTo(-16.716, 2);
    expect(sirius.ci).toBeCloseTo(0, 1);
    expect(() => decodeStars(new ArrayBuffer(17))).toThrow();
  });
  it('uses correct sphere axes and latitude-sensitive J2000 zenith', () => {
    expect(equatorialPoint(0, 0, 1)).toEqual([1, 0, 0]);
    expect(equatorialPoint(90, 0, 1)[2]).toBeCloseTo(1);
    const north = zenithAt(new Date('2000-01-01T12:00:00Z'), { lat: 90, lng: 0 });
    expect(north[1]).toBeCloseTo(1, 3);
    const equator = zenithAt(new Date('2000-01-01T12:00:00Z'), { lat: 0, lng: 0 });
    expect(equator[1]).toBeCloseTo(0, 3);
    expect(planetsAt(new Date('2026-10-05T00:00:00Z'), { lat: 0, lng: 0 })).toHaveLength(7);
  });
  it('degrades below 30fps after 60 rendered frames and excludes reset/hidden gaps', () => {
    const monitor = new FrameMonitor();
    for (let i = 0; i < 59; i++) expect(monitor.sample(i * 50)).toBe(false);
    expect(monitor.sample(59 * 50)).toBe(true);
    monitor.reset();
    for (let i = 0; i < 60; i++) expect(monitor.sample(1_000_000 + i * 16.667)).toBe(false);
  });
  it('returns actual moon/day/term without a profile and deterministic personal preview with one', () => {
    const instant = '2026-10-05T00:00:00Z';
    const empty = computeHomeInsights(undefined, instant, 'Asia/Singapore');
    expect(empty.daily).toBeNull();
    expect(empty.sky.phase).toBe('last_quarter');
    expect(empty.sky.term).toBe('qiu_fen');
    const birth = baziReading('zh').request.birth!;
    const personal = computeHomeInsights(birth, instant, 'Asia/Singapore');
    expect(personal.daily?.scores.overall).toBeGreaterThanOrEqual(0);
    expect(personal.daily?.bazi.luckyColorHex).toMatch(/^#[a-f\d]{6}$/i);
    expect(computeHomeInsights(birth, instant, 'Asia/Singapore')).toEqual(personal);
    expect(
      computeHomeInsights({ ...birth, timeUnknown: true }, instant, 'Asia/Singapore').daily,
    ).not.toBeNull();
  });
});
