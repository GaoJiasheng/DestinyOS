import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kv: new Map<string, string>(),
  hits: new Map<string, number[]>(),
  jar: new Map<string, string>(),
  setCookie: vi.fn(),
  signIn: vi.fn(),
  callback: vi.fn(),
  deletedMail: vi.fn(),
}));
vi.mock('../lib/cache', () => ({
  cacheRead: async (key: string) => {
    const raw = mocks.kv.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  },
  cacheWrite: async (key: string, value: unknown) => void mocks.kv.set(key, JSON.stringify(value)),
  cacheDelete: async (key: string) => void mocks.kv.delete(key),
}));
vi.mock('../lib/ratelimit', async (original) => {
  const actual = await original<typeof import('../lib/ratelimit')>();
  return {
    ...actual,
    limitMagicLink: async () => undefined,
    ratelimit: (route: Parameters<typeof actual.ratelimit>[0], identity: string) =>
      actual.localRatelimit(mocks.hits, route, identity),
  };
});
vi.mock('../lib/auth', () => ({
  signIn: mocks.signIn,
  signOut: vi.fn(),
  handlers: { GET: mocks.callback },
}));
vi.mock('../lib/auth-email', () => ({ sendAccountDeletedEmail: mocks.deletedMail }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options?: unknown) => {
      mocks.setCookie(name, value, options);
      mocks.jar.set(name, value);
    },
    delete: (name: string) => void mocks.jar.delete(name),
  }),
  headers: async () =>
    new Headers({
      origin: 'http://localhost:3100',
      host: 'localhost:3100',
      'x-real-ip': '1.2.3.4',
    }),
}));
import { sendMagicLinkAction } from '../app/[locale]/auth/actions';
import { verifyLoginCodeAction } from '../app/[locale]/auth/code-actions';
import { issueLoginCode, loginDeviceCookie, openLoginDeviceTicket } from '../lib/auth-code';

const email = 'person@example.test';
const token = 'f'.repeat(64);
let issued: string | undefined;
beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'unit-test-secret');
  vi.clearAllMocks();
  mocks.kv.clear();
  mocks.hits.clear();
  mocks.jar.clear();
  issued = undefined;
  mocks.deletedMail.mockResolvedValue(undefined);
  // Stand-in for Auth.js: open the ticket the way sendVerificationRequest does and issue a code.
  mocks.signIn.mockImplementation(
    async (_provider: string, options: { email: string; loginDevice: string }) => {
      const device = await openLoginDeviceTicket(options.email, options.loginDevice);
      if (device) issued = await issueLoginCode(options.email, token, device);
      return '/api/auth/verify-request?provider=resend&type=email';
    },
  );
  mocks.callback.mockResolvedValue(
    new Response(null, { status: 302, headers: { Location: 'http://localhost:3100/zh/me' } }),
  );
});

describe('sign-in code actions', () => {
  it('binds the code to this browser and signs in through the Auth.js callback', async () => {
    expect(await sendMagicLinkAction(email, 'zh', '/zh/me')).toEqual({ ok: true, email });
    const ticket = mocks.signIn.mock.calls[0]?.[1].loginDevice as string;
    expect(ticket.startsWith(`${mocks.jar.get(loginDeviceCookie)}.`)).toBe(true);
    expect(mocks.setCookie).toHaveBeenCalledWith(
      loginDeviceCookie,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 900 }),
    );
    expect(await verifyLoginCodeAction('zh', email, issued ?? '')).toEqual({
      ok: true,
      target: '/zh/me',
    });
    const callback = new URL(mocks.callback.mock.calls[0]?.[0].url);
    expect(callback.pathname).toBe('/api/auth/callback/resend');
    expect(callback.searchParams.get('token')).toBe(token);
    expect(callback.searchParams.get('callbackUrl')).toBe('/zh/me');
    expect(mocks.jar.has(loginDeviceCookie)).toBe(false);
  });
  it('rejects the code from a browser that did not request it', async () => {
    await sendMagicLinkAction(email, 'zh');
    mocks.jar.clear();
    expect(await verifyLoginCodeAction('zh', email, issued ?? '')).toEqual({
      ok: false,
      code: 'E_CODE',
      attemptsLeft: undefined,
    });
    expect(mocks.callback).not.toHaveBeenCalled();
  });
  it('a resend replaces the cookie so the earlier code no longer works', async () => {
    await sendMagicLinkAction(email, 'zh');
    const first = issued ?? '';
    await sendMagicLinkAction(email, 'zh');
    if (first === issued) return;
    expect((await verifyLoginCodeAction('zh', email, first)).ok).toBe(false);
    expect((await verifyLoginCodeAction('zh', email, issued ?? '')).ok).toBe(true);
  });
  it('a deleted account gets the same page answer, the same cookies and the same code error', async () => {
    await sendMagicLinkAction(email, 'zh');
    const normalCookies = mocks.setCookie.mock.calls.map(([name]) => name);
    const normalError = await verifyLoginCodeAction(
      'zh',
      email,
      String((Number(issued) + 1) % 1_000_000).padStart(6, '0'),
    );
    mocks.setCookie.mockClear();
    mocks.signIn.mockResolvedValueOnce(
      '/zh/auth/login?error=AccountDeleted&until=2026-11-23T00%3A00%3A00.000Z',
    );
    const deleted = 'gone@example.test';
    expect(await sendMagicLinkAction(deleted, 'zh')).toEqual({ ok: true, email: deleted });
    expect(mocks.deletedMail).toHaveBeenCalledTimes(1);
    expect(mocks.setCookie.mock.calls.map(([name]) => name)).toEqual(normalCookies);
    expect(await verifyLoginCodeAction('zh', deleted, '123456')).toEqual(normalError);
    expect(normalError).toEqual({ ok: false, code: 'E_CODE', attemptsLeft: 4 });
  });
  it('rejects malformed codes without spending an attempt', async () => {
    expect(await verifyLoginCodeAction('zh', email, '12345')).toEqual({
      ok: false,
      code: 'E_FORMAT',
    });
    expect(mocks.hits.size).toBe(0);
  });
});
