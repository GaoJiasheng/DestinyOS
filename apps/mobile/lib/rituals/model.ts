import { Temporal } from '@js-temporal/polyfill';
import { createRandom, hashSeed, type ComputeInput } from '@tianji/engine';
import { TAROT_SPREADS, type SpreadKey } from '@tianji/shared';

export type RitualInput = Pick<
  ComputeInput,
  'question' | 'spread' | 'category' | 'allowReversed' | 'pickedIndices'
>;
export type CoinCount = 0 | 1 | 2 | 3;
/** Current civil clock in an explicit IANA zone, preserving local lunar/hour calculations. */
export function ritualClock(tz: string, instant = new Date().toISOString()) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(tz).toString();
}
/** Unbiased three-coin count; the physical shake/button instant participates in the replay seed. */
export function throwCoins(seed: string, round: number, instant: number): CoinCount {
  const rng = createRandom(hashSeed(`${seed}|${round}|${instant}`));
  return [rng.next(), rng.next(), rng.next()].filter((v) => v < 0.5).length as CoinCount;
}
/** Validate the documented two or three integer inputs without silently dropping malformed fields. */
export function parseNumbers(values: string[]): number[] | null {
  const present = values.slice(0, 2).concat(values[2]?.trim() ? [values[2]] : []);
  if (!present.every((v) => /^[1-9]\d{0,2}$/.test(v.trim()))) return null;
  return present.map((v) => Number(v));
}
/** Select only unpicked card indices, using the same seeded generator as the shared engine. */
export function automaticPicks(seed: string, spread: SpreadKey, picked: number[]) {
  const rng = createRandom(hashSeed(`${seed}|auto|${picked.join(',')}`));
  const available = Array.from({ length: 78 }, (_, i) => i).filter((i) => !picked.includes(i));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [available[i], available[j]] = [available[j]!, available[i]!];
  }
  return [...picked, ...available.slice(0, TAROT_SPREADS[spread].length - picked.length)];
}
/** Acceleration in g, with a resting re-arm and the documented 800ms refractory period. */
export function createShakeGate() {
  // DESIGN-GAP: Use 2.2g to reject ordinary handling; require a return below 1.3g to re-arm.
  let armed = true;
  let last = -Infinity;
  return (sample: { x: number; y: number; z: number }, milliseconds: number) => {
    const magnitude = Math.hypot(sample.x, sample.y, sample.z);
    if (magnitude < 1.3) armed = true;
    if (!armed || magnitude < 2.2 || milliseconds - last < 800) return false;
    armed = false;
    last = milliseconds;
    return true;
  };
}
