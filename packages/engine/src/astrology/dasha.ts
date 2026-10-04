import { Temporal } from '@js-temporal/polyfill';
import { type VedicChart } from '@tianji/shared';
import { DASHA_LORDS, DASHA_YEARS, nakshatraAt } from './vedic-rules';
import { wrap } from './math';
export const YEAR_DAYS = 365.25;
/** Convert UT Julian day to explicit UTC ISO instant (millisecond precision). */
export const jdToISO = (jd: number): string =>
  Temporal.Instant.fromEpochMilliseconds(Math.round((jd - 2440587.5) * 86400000)).toString({
    smallestUnit: 'millisecond',
  });
/** Vimshottari Maha+Antar, first Maha clipped to birth, subdivisions retain the full Maha origin; horizon birth+120 years. now is caller supplied UT JD. */
export function vimshottari(
  birthJD: number,
  moonSidLon: number,
  nowJD: number,
  includeAntar = true,
): VedicChart['dasha'] {
  const mansion = nakshatraAt(moonSidLon),
    startIndex = DASHA_LORDS.indexOf(mansion.lord),
    progress = (wrap(moonSidLon) * 3) / 40 - mansion.index,
    elapsed = Math.abs(progress) < 1e-12 ? 0 : progress;
  let start = birthJD - elapsed * DASHA_YEARS[mansion.lord] * YEAR_DAYS;
  const horizon = birthJD + 120 * YEAR_DAYS,
    sequence: VedicChart['dasha']['sequence'] = [];
  // DESIGN-GAP: Clip the first/last visible Maha and Antar to the birth-to-120-year horizon; retain their true origins for subdivision arithmetic.
  for (let i = 0; start < horizon; i++) {
    const lord = DASHA_LORDS[(startIndex + i) % 9]!,
      duration = DASHA_YEARS[lord] * YEAR_DAYS,
      end = start + duration,
      from = Math.max(birthJD, start),
      to = Math.min(horizon, end),
      antar: VedicChart['dasha']['sequence'][number]['antar'] = [];
    let subStart = start;
    if (includeAntar)
      for (let j = 0; j < 9; j++) {
        const sublord = DASHA_LORDS[(startIndex + i + j) % 9]!,
          subEnd = subStart + (duration * DASHA_YEARS[sublord]) / 120;
        if (subEnd > from && subStart < to) {
          const s = Math.max(from, subStart),
            e = Math.min(to, subEnd);
          antar.push({
            lord: sublord,
            from: jdToISO(s),
            to: jdToISO(e),
            current: nowJD >= s && nowJD < e,
          });
        }
        subStart = subEnd;
      }
    sequence.push({
      lord,
      from: jdToISO(from),
      to: jdToISO(to),
      current: nowJD >= from && nowJD < to,
      antar,
    });
    start = end;
  }
  return { sequence };
}
