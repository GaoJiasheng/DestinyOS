import { expect, it, vi } from 'vitest';
vi.mock('@noble/hashes/sha256', () => ({ sha256: () => new Uint8Array(32) }));
import { createRandom } from '../src/common/random';
it('escapes the xoshiro absorbing zero state if a hash provider returns all zeroes', () => {
  const random = createRandom('zero-state');
  expect(random.nextUint32()).toBe(0);
  expect(random.nextUint32()).toBe(5760);
});
