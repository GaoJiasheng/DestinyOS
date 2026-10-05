import { describe, expect, it } from 'vitest';
import { jdToISO, nakshatraAt, vimshottari, YEAR_DAYS } from '../src';

describe('Vimshottari hand calculations and horizon', () => {
  it('Rohini pada 2 at 45° has 5/8 of the ten-year Moon Maha remaining', () => {
    // Rohini 40°..53°20′, 45° is 3/8 elapsed. Original Maha begins 3.75 years before birth.
    const birth = 2451545,
      d = vimshottari(birth, 45, birth),
      first = d.sequence[0]!;
    expect(nakshatraAt(45)).toMatchObject({ nakshatra: 'rohini', pada: 2, lord: 'chandra' });
    expect(first.lord).toBe('chandra');
    expect(first.from).toBe(jdToISO(birth));
    expect(first.to).toBe(jdToISO(birth + 6.25 * 365.25));
    expect(first.current).toBe(true);
    // After Moon 10/12 year, Mars 7/12, Rahu 18/12, Jupiter 16/12: 4.25 years elapsed. Birth at 3.75 is Jupiter Antar.
    expect(first.antar[0]!.lord).toBe('guru');
    expect(first.antar[0]!.to).toBe(jdToISO(birth + 0.5 * 365.25));
    expect(first.antar[0]!.current).toBe(true);
    expect(d.sequence[1]!.lord).toBe('mangala');
    expect(d.sequence[1]!.to).toBe(jdToISO(birth + 13.25 * 365.25));
  });
  it('starts at Ketu at Ashwini zero; nine Antar durations sum exactly to their Maha', () => {
    const d = vimshottari(2451545, 0, 2451545),
      first = d.sequence[0]!;
    expect(first.lord).toBe('ketu');
    expect(first.antar).toHaveLength(9);
    expect(first.antar[0]!.to).toBe(jdToISO(2451545 + ((7 * 7) / 120) * YEAR_DAYS));
    for (let i = 0; i < d.sequence.length; i++) {
      const m = d.sequence[i]!;
      expect(m.antar[0]!.from).toBe(m.from);
      expect(m.antar.at(-1)!.to).toBe(m.to);
      if (i) expect(m.from).toBe(d.sequence[i - 1]!.to);
      for (let j = 1; j < m.antar.length; j++) expect(m.antar[j]!.from).toBe(m.antar[j - 1]!.to);
    }
    expect(d.sequence.at(-1)!.to).toBe(jdToISO(2451545 + 120 * YEAR_DAYS));
  });
  it('selects exactly one current Maha/Antar at a boundary and zero outside the horizon', () => {
    const b = 2451545,
      d = vimshottari(b, 0, b + 7 * YEAR_DAYS);
    expect(d.sequence.filter((m) => m.current).map((m) => m.lord)).toEqual(['shukra']);
    expect(d.sequence.flatMap((m) => m.antar).filter((a) => a.current)).toHaveLength(1);
    expect(vimshottari(b, 0, b - 1).sequence.some((m) => m.current)).toBe(false);
    expect(vimshottari(b, 0, b + 121 * YEAR_DAYS).sequence.some((m) => m.current)).toBe(false);
    expect(vimshottari(b, 45, b, false).sequence.every((m) => !m.antar.length)).toBe(true);
  });
});
