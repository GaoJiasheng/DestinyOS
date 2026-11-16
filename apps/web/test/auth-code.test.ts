import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-error';

const store = vi.hoisted(() => ({
  kv: new Map<string, string>(),
  hits: new Map<string, number[]>(),
}));
vi.mock('../lib/cache', () => ({
  cacheRead: async (key: string) => {
    const raw = store.kv.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  },
  cacheWrite: async (key: string, value: unknown) => void store.kv.set(key, JSON.stringify(value)),
  cacheDelete: async (key: string) => void store.kv.delete(key),
}));
vi.mock('../lib/ratelimit', async (original) => {
  const actual = await original<typeof import('../lib/ratelimit')>();
  return {
    ...actual,
    ratelimit: (route: Parameters<typeof actual.ratelimit>[0], identity: string) =>
      actual.localRatelimit(store.hits, route, identity),
  };
});
import {
  constantTimeEqual,
  generateLoginCode,
  issueLoginCode,
  loginDeviceTicket,
  maxLoginCodeAttempts,
  newLoginDevice,
  openLoginDeviceTicket,
  redeemLoginCode,
} from '../lib/auth-code';
import { magicLinkEmail } from '../lib/auth-email';

const email = 'person@example.test';
const token = 'a'.repeat(64);
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');
beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'unit-test-secret');
  store.kv.clear();
  store.hits.clear();
});

describe('code generation', () => {
  it('keeps leading zeros and rejects the biased top of the 32-bit range', () => {
    const values = [0xffff_ffff, 42];
    const random = vi.fn((buffer: Uint32Array) => {
      buffer[0] = values.shift() ?? 0;
      return buffer;
    });
    expect(generateLoginCode(random)).toBe('000042');
    expect(random).toHaveBeenCalledTimes(2);
  });
  it('always yields six digits from the platform CSPRNG', () => {
    for (let index = 0; index < 2000; index++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });
  it('compares in constant time and still distinguishes lengths', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('device tickets', () => {
  it('opens only a server-minted ticket for the same email', async () => {
    const device = newLoginDevice();
    const ticket = await loginDeviceTicket(email, device);
    expect(await openLoginDeviceTicket(email, ticket)).toBe(device);
    expect(await openLoginDeviceTicket('other@example.test', ticket)).toBeNull();
    expect(await openLoginDeviceTicket(email, `${device}.forged`)).toBeNull();
    expect(await openLoginDeviceTicket(email, device)).toBeNull();
    expect(await openLoginDeviceTicket(email, 42)).toBeNull();
  });
});

describe('issue and redeem', () => {
  it('stores only a keyed hash of the code and an encrypted token, then redeems once', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device);
    const [key, raw] = [...store.kv.entries()][0] ?? [];
    expect(key).toMatch(/^auth:code:/);
    expect(`${key}${raw}`).not.toContain(email);
    expect(raw).not.toContain(code);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(device);
    expect(await redeemLoginCode({ email, code, device, ip: '1.1.1.1' })).toEqual({
      ok: true,
      token,
    });
    expect(store.kv.size).toBe(0);
    expect(await redeemLoginCode({ email, code, device, ip: '1.1.1.1' })).toEqual({
      ok: false,
      attemptsLeft: maxLoginCodeAttempts - 2,
    });
  });
  it('voids the code after five wrong tries, even if the right digits follow', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device);
    const left: (number | undefined)[] = [];
    for (let index = 0; index < maxLoginCodeAttempts; index++) {
      const result = await redeemLoginCode({ email, code: wrong(code), device, ip: '1.1.1.1' });
      left.push(result.ok ? undefined : result.attemptsLeft);
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
    expect(store.kv.size).toBe(0);
    expect(await redeemLoginCode({ email, code, device, ip: '1.1.1.1' })).toEqual({
      ok: false,
      attemptsLeft: 0,
      exhausted: true,
    });
  });
  it('checks at most five guesses when many arrive at once', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device);
    const guesses = [...Array(8)].map(() => wrong(code)).concat(code);
    const results = await Promise.all(
      guesses.map((guess) => redeemLoginCode({ email, code: guess, device, ip: '1.1.1.1' })),
    );
    expect(results.some((result) => result.ok)).toBe(false);
    expect(results.at(-1)).toEqual({ ok: false, attemptsLeft: 0, exhausted: true });
  });
  it('a resend invalidates the previous code immediately', async () => {
    const first = newLoginDevice();
    const old = await issueLoginCode(email, 'b'.repeat(64), first);
    const second = newLoginDevice();
    const fresh = await issueLoginCode(email, token, second);
    expect((await redeemLoginCode({ email, code: old, device: first, ip: '1.1.1.1' })).ok).toBe(
      false,
    );
    expect(await redeemLoginCode({ email, code: fresh, device: second, ip: '1.1.1.1' })).toEqual({
      ok: true,
      token,
    });
  });
  it('refuses the right code from a browser without the binding cookie', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device);
    expect(await redeemLoginCode({ email, code, ip: '2.2.2.2' })).toEqual({ ok: false });
    const elsewhere = await redeemLoginCode({
      email,
      code,
      device: newLoginDevice(),
      ip: '2.2.2.2',
    });
    expect(elsewhere).toEqual({ ok: false, attemptsLeft: 4 });
    // Strangers burning their own attempts cannot void the owner's pending code.
    const stranger = newLoginDevice();
    for (let index = 0; index < maxLoginCodeAttempts; index++)
      await redeemLoginCode({ email, code, device: stranger, ip: '3.3.3.3' });
    expect(await redeemLoginCode({ email, code, device, ip: '1.1.1.1' })).toEqual({
      ok: true,
      token,
    });
  });
  it('answers an address with no code (unknown or deleted account) exactly like a wrong code', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device);
    const wrongCode = await redeemLoginCode({ email, code: wrong(code), device, ip: '1.1.1.1' });
    const ghostDevice = newLoginDevice();
    const ghost = await redeemLoginCode({
      email: 'deleted@example.test',
      code: '123456',
      device: ghostDevice,
      ip: '1.1.1.2',
    });
    expect(ghost).toEqual(wrongCode);
  });
  it('rejects a code after its expiry', async () => {
    const device = newLoginDevice();
    const code = await issueLoginCode(email, token, device, Date.now() - 16 * 60_000);
    expect((await redeemLoginCode({ email, code, device, ip: '1.1.1.1' })).ok).toBe(false);
  });
});

describe('rate limits', () => {
  it('limits code checks per IP and per email with the standard 429 error', async () => {
    for (let index = 0; index < 10; index++)
      await redeemLoginCode({
        email: `p${index}@example.test`,
        code: '000000',
        device: 'd',
        ip: '9.9.9.9',
      });
    await expect(
      redeemLoginCode({ email: 'p99@example.test', code: '000000', device: 'd', ip: '9.9.9.9' }),
    ).rejects.toMatchObject({ code: 'E_RATE_LIMITED' });
    for (let index = 0; index < 10; index++)
      await redeemLoginCode({ email, code: '000000', device: `d${index}`, ip: `10.0.0.${index}` });
    const blocked = redeemLoginCode({ email, code: '000000', device: 'x', ip: '10.0.1.1' });
    await expect(blocked).rejects.toBeInstanceOf(ApiError);
  });
});

describe('email template', () => {
  it('adds the code to both bodies but never to the subject', () => {
    const url = 'https://example.test/zh/auth/verify?token=abc&email=a%40b.c';
    for (const locale of ['zh', 'en'] as const) {
      const mail = magicLinkEmail(locale, url, '012345');
      expect(mail.subject).not.toContain('012345');
      expect(mail.text).toMatch(/^012345$/m);
      expect(mail.html).toContain('012345');
      expect(mail.text.match(/https?:\/\/\S+/)?.[0]).toBe(url);
      expect(magicLinkEmail(locale, url).text).not.toMatch(/^\d{6}$/m);
    }
  });
});
