import { describe, expect, it } from 'vitest';
import { ayanamsaLahiri, computePanchang, computePositions, karanaKey, wrap } from '../src';
import { jd } from './astrology-fixtures';
import delhi from './fixtures/astrology/new-delhi-2026-10-04.json';

describe('Panchang reference and transition root solving', () => {
  it('matches Drik Panchang 2026-10-04 New Delhi: Navami, Punarvasu→Pushya, Parigha→Shiva, Taitila→Garaja', () => {
    // docs/appendix/research-competitors.md records the Drik provider/fields (its example location is Houston).
    // Date/location reference: https://www.drikpanchang.com/panchang/month-panchang.html?geoname-id=1273294&date=04/10/2026
    // Independently verified reference ends: Navami Oct 5 03:53 IST; Punarvasu Oct 5 00:13 IST; Parigha Oct 4 12:32 IST.
    const p = computePanchang(delhi.date, delhi.place);
    expect(p.tithi).toMatchObject({ index: 24, key: 'navami' });
    expect(p.nakshatra.key).toBe('punarvasu');
    expect(p.yoga.key).toBe('parigha');
    expect(p.karana.key).toBe('taitila');
    expect(p.vara.key).toBe('raviwara');
    expect(p.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ limb: 'nakshatra', key: 'pushya' }),
        expect.objectContaining({ limb: 'yoga', key: 'shiva' }),
        expect.objectContaining({ limb: 'karana', key: 'garaja' }),
      ]),
    );
    // DESIGN-GAP: Panchang minute tolerance is unspecified; adopt 3 minutes for independent end-time references at ±1′ ephemeris precision.
    for (const [actual, reference] of [
      [p.tithi.endsAt, delhi.tithi.endsAt],
      [p.nakshatra.endsAt, delhi.nakshatra.endsAt],
      [p.yoga.endsAt, delhi.yoga.endsAt],
    ])
      expect(Math.abs(jd(actual!) - jd(reference!)) * 1440).toBeLessThan(delhi.toleranceMinutes);
    for (const change of p.transitions) {
      expect(change.endsAt > change.startsAt).toBe(true);
      expect(change.startsAt > p.sunrise!).toBe(true);
      expect(change.startsAt < p.vara.endsAt).toBe(true);
    }
  });
  it.each(Array.from({ length: 60 }, (_, i) => i))('maps Karana half-tithi %s', (index) => {
    const expected =
      index === 0
        ? 'kimstughna'
        : index >= 57
          ? ['shakuni', 'chatushpada', 'naga'][index - 57]
          : ['bava', 'balava', 'kaulava', 'taitila', 'garaja', 'vanija', 'vishti'][(index - 1) % 7];
    expect(karanaKey(index)).toBe(expected);
  });
  it.each(['2026-10-10', '2026-10-25', '2026-10-26', '2026-12-21'])(
    'solves every limb at a boundary including lunar cycle wrap: %s',
    (date) => {
      const p = computePanchang(date, { lat: 28.6139, lng: 77.209, tz: 'Asia/Kolkata' });
      for (const limb of ['tithi', 'nakshatra', 'yoga', 'karana'] as const) {
        const t = jd(p[limb].endsAt),
          before = computePositions(t - 1 / 86400, ['sun', 'moon']),
          after = computePositions(t + 1 / 86400, ['sun', 'moon']);
        const angle = (positions: typeof before, time: number) =>
          limb === 'tithi' || limb === 'karana'
            ? wrap(positions.moon.lon - positions.sun.lon)
            : limb === 'nakshatra'
              ? wrap(positions.moon.lon - ayanamsaLahiri(time))
              : wrap(positions.sun.lon + positions.moon.lon - 2 * ayanamsaLahiri(time));
        const width = limb === 'tithi' ? 12 : limb === 'karana' ? 6 : 40 / 3;
        expect(Math.floor(angle(before, t - 1 / 86400) / width)).not.toBe(
          Math.floor(angle(after, t + 1 / 86400) / width),
        );
      }
    },
  );
  it('uses previous sunrise Vara for pre-dawn birth and explicit polar-midnight fallback', () => {
    const place = { lat: 28.6139, lng: 77.209, tz: 'Asia/Kolkata' },
      before = computePanchang('2026-10-04', place, jd('2026-10-03T22:00:00Z'));
    expect(before.date).toBe('2026-10-03');
    expect(before.vara.key).toBe('shaniwara');
    const polar = computePanchang('2026-12-21', { lat: 89, lng: 0, tz: 'UTC' });
    expect(polar.sunrise).toBeNull();
    expect(polar.sunset).toBeNull();
    expect(polar.vara.endsAt).toBe('2026-12-22T00:00:00.000Z');
    expect(() => computePanchang('bad', place)).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    );
  });
});
