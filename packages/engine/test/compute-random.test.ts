import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { createHash } from 'node:crypto';
import { System, EngineResultSchema, EngineErrorCode } from '@tianji/shared';
import {
  compute,
  normalizeBirth,
  ENGINE_VERSION,
  EngineError,
  ERROR_MESSAGE_KEYS,
  createRandom,
  hashSeed,
} from '../src';
import { version } from '../package.json';
import A from './fixtures/birth/A.json';
import E from './fixtures/birth/E.json';
const now = '2026-10-04T00:00:00Z';
describe('uniform dispatch and safe errors', () => {
  it.each(Object.values(System).filter((system) => system !== 'bazi'))(
    'registers %s with a valid placeholder result envelope',
    (system) => {
      const birth = normalizeBirth(A);
      const input = { system, birth, now };
      const result = compute(input);
      expect(result).toEqual({
        system,
        engineVersion: version,
        computedAt: now,
        input: birth,
        chart: {},
        meta: { schoolUsed: {}, warnings: birth.warnings, debug: { placeholder: true } },
      });
      expect(EngineResultSchema.safeParse(result).success).toBe(true);
      expect(ENGINE_VERSION).toBe(version);
      expect(JSON.stringify(compute(input))).toBe(JSON.stringify(result));
    },
  );
  it('allows divination without birth and preserves explicit Temporal now', () => {
    expect(compute({ system: 'tarot', now, seed: 'fixed' }).input).toBeNull();
    expect(compute({ system: 'tarot', now: '2026-10-04T00:00:00.123456789Z' }).computedAt).toBe(
      '2026-10-04T00:00:00.123456789Z',
    );
    expect(
      compute({ system: 'iching', now: Temporal.Instant.from(now), question: { method: 'time' } })
        .computedAt,
    ).toBe(now);
    expect(
      compute({
        system: 'qimen',
        now: Temporal.ZonedDateTime.from('2026-10-04T08:00[Asia/Shanghai]'),
      }).computedAt,
    ).toBe(now);
    expect(compute({ system: 'iching', birth: null, now }).input).toBeNull();
  });
  it('preserves uncertainty warnings and refuses ziwei without birth time', () => {
    const birth = normalizeBirth(E);
    expect(() => compute({ system: 'ziwei', birth, now })).toThrow(
      expect.objectContaining({ code: 'E_REQUIRES_BIRTH_TIME' }),
    );
    expect(compute({ system: 'bazi', birth, now }).meta.warnings[0]?.code).toBe('W_NO_HOUR_PILLAR');
    for (const system of ['astrology', 'vedic'] as const)
      expect(compute({ system, birth, now }).meta.warnings[0]?.code).toBe('W_NOON_CHART');
  });
  it('rejects missing birth, invalid now, unknown systems and unsupported school', () => {
    expect(() => compute({ system: 'bazi', now })).toThrow(EngineError);
    expect(() => compute({ system: 'tarot', now: '2026-10-04T12:00:00' })).toThrow(EngineError);
    expect(() => compute({ system: 'tarot', now, options: { school: { unknown: true } } })).toThrow(
      expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }),
    );
    expect(() => compute({ system: 'invalid' as System, now })).toThrow(EngineError);
    expect(() => compute({ system: 'tarot', now: undefined as unknown as string })).toThrow(
      EngineError,
    );
  });
  it('maps every documented error to a translation key and redacts invalid input details', () => {
    for (const code of Object.values(EngineErrorCode)) {
      const error = new EngineError(code);
      expect(error.name).toBe('EngineError');
      expect(error.message).toBe(ERROR_MESSAGE_KEYS[code]);
    }
    const error = new EngineError('E_EPHEMERIS', 'engine.errors.E_EPHEMERIS', {
      component: 'test',
    });
    expect(error.details).toEqual({ component: 'test' });
    try {
      normalizeBirth({ ...A, hour: 100 });
    } catch (error) {
      expect((error as EngineError).details).toEqual({
        issues: [{ code: 'too_big', path: ['hour'] }],
      });
      expect(JSON.stringify((error as EngineError).details)).not.toContain('1990');
    }
  });
});
describe('SHA-256 seed and xoshiro128** browser-compatible streams', () => {
  it.each(['', 'abc', 'user-id|2026-10-04', '天机🌌'])(
    'matches Node SHA-256 reference for %s',
    (seed) => {
      expect(hashSeed(seed)).toBe(createHash('sha256').update(seed, 'utf8').digest('hex'));
    },
  );
  it('matches an independent unsigned-integer xoshiro reference for 1,000 outputs', () => {
    const digest = createHash('sha256').update('golden').digest();
    let a = digest.readUInt32BE(0),
      b = digest.readUInt32BE(4),
      c = digest.readUInt32BE(8),
      d = digest.readUInt32BE(12);
    const rng = createRandom('golden');
    const rotate = (x: number, k: number) => (x * 2 ** k + (x >>> (32 - k))) >>> 0;
    for (let i = 0; i < 1000; i++) {
      const expected = (rotate((b * 5) >>> 0, 7) * 9) >>> 0;
      expect(rng.nextUint32()).toBe(expected);
      const t = (b << 9) >>> 0;
      c = (c ^ a) >>> 0;
      d = (d ^ b) >>> 0;
      b = (b ^ c) >>> 0;
      a = (a ^ d) >>> 0;
      c = (c ^ t) >>> 0;
      d = rotate(d, 11);
    }
  });
  it('replays a seed, differentiates other seeds, and keeps draws in [0,1)', () => {
    const x = createRandom('replay'),
      y = createRandom('replay'),
      z = createRandom('different');
    let different = false;
    for (let i = 0; i < 10000; i++) {
      const value = x.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(value).toBe(y.next());
      if (value !== z.next()) different = true;
    }
    expect(different).toBe(true);
  });
});
