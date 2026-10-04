import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
/** Deterministic SHA-256 hex digest of a UTF-8 seed, with no Node crypto requirement. */
export function hashSeed(seed: string): string {
  return bytesToHex(sha256(utf8ToBytes(seed)));
}
const rotateLeft = (x: number, k: number) => (x << k) | (x >>> (32 - k));
export type RandomSource = { nextUint32: () => number; next: () => number };
/** Seeded xoshiro128**; SHA-256's first four big-endian words initialize state, output is [0,1). */
export function createRandom(seed: string): RandomSource {
  // DESIGN-GAP: Specify big-endian SHA-256 truncation so browser/server streams have a stable seed protocol.
  const digest = sha256(utf8ToBytes(seed));
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const state = [0, 4, 8, 12].map((offset) => view.getUint32(offset, false));
  // SHA-256 input seeds never intentionally expose a zero state; keep a defined guard against the absorbing state.
  if (state.reduce((combined, word) => combined | word, 0) === 0) state[0] = 1;
  const nextUint32 = () => {
    const result = Math.imul(rotateLeft(Math.imul(state[1]!, 5), 7), 9) >>> 0;
    const t = state[1]! << 9;
    state[2] = state[2]! ^ state[0]!;
    state[3] = state[3]! ^ state[1]!;
    state[1] = state[1]! ^ state[2]!;
    state[0] = state[0]! ^ state[3]!;
    state[2] = state[2]! ^ t;
    state[3] = rotateLeft(state[3]!, 11);
    return result;
  };
  return { nextUint32, next: () => nextUint32() / 4294967296 };
}
