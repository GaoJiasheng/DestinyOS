import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestIp } from '../lib/request-ip';
import { ApiError } from '../lib/api-error';
import { createLogger } from '../lib/logger';
import { beforeSend } from '../lib/sentry';

const mock = vi.hoisted(() => ({ limit: vi.fn(), auth: vi.fn(), render: vi.fn(), share: vi.fn() }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = mock.limit;
  },
}));
vi.mock('../lib/redis', () => ({ getUpstashRedis: vi.fn() }));
vi.mock('../lib/auth', () => ({ auth: mock.auth }));
vi.mock('../lib/og-card', () => ({ renderCard: mock.render }));
vi.mock('../lib/share-service', async (original) => ({
  ...(await original<typeof import('../lib/share-service')>()),
  publicShare: mock.share,
}));
import { ratelimit } from '../lib/ratelimit';
import { signDailyCard } from '../lib/share-service';
import { GET as dailyImage } from '../app/api/v1/og/daily/route';
import { GET as shareImage } from '../app/api/v1/og/share/[token]/route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
  vi.stubEnv('AUTH_SECRET', 'isolated-audit-secret');
  mock.auth.mockResolvedValue(null);
  mock.limit.mockResolvedValue({ success: true, reset: Date.now() + 3600000 });
  mock.share.mockResolvedValue({ locale: 'en', headline: 'Safe' });
  mock.render.mockResolvedValue(new Response('image'));
});
afterEach(() => vi.unstubAllEnvs());

describe('security audit regressions', () => {
  it('fails closed when Upstash returns its default success-on-timeout response', async () => {
    mock.limit.mockResolvedValue({ success: true, reason: 'timeout', reset: 0 });
    await expect(ratelimit('magic.email', 'owner@example.test')).rejects.toMatchObject({
      status: 503,
    });
    expect(
      (
        await shareImage(new Request('https://example.test/api/v1/og/share/' + 'A'.repeat(22)), {
          params: Promise.resolve({ token: 'A'.repeat(22) }),
        })
      ).status,
    ).toBe(503);
    expect(mock.share).not.toHaveBeenCalled();
    expect(mock.render).not.toHaveBeenCalled();
  });

  it('uses a trusted, normalized IP identity and rejects spoofed production forwarding', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '');
    expect(requestIp(new Headers({ 'x-forwarded-for': '192.0.2.1' }))).toBe('unknown');
    vi.stubEnv('VERCEL', '1');
    expect(requestIp(new Headers({ 'x-forwarded-for': '192.0.2.1, 198.51.100.9' }))).toBe(
      '192.0.2.1',
    );
    expect(requestIp(new Headers({ 'x-forwarded-for': 'invalid' }))).toBe('unknown');
    expect(requestIp(new Headers({ 'x-forwarded-for': '2001:0db8:0:0:0:0:0:1' }))).toBe(
      requestIp(new Headers({ 'x-forwarded-for': '2001:db8::1' })),
    );
  });

  it('limits actual OG rendering and rejects invalid daily signatures before authentication/IO', async () => {
    mock.limit.mockResolvedValue({ success: false, reset: Date.now() + 3600000 });
    const signed = signDailyCard({
      locale: 'en',
      date: '2026-10-05',
      headline: 'Safe',
      stars: 3,
      color: 'Teal',
      numbers: [3],
      do: ['Listen'],
      dont: ['Rush'],
    });
    expect(
      (
        await dailyImage(
          new Request(`https://example.test/api/v1/og/daily?${new URLSearchParams(signed)}`),
        )
      ).status,
    ).toBe(429);
    expect(mock.render).not.toHaveBeenCalled();
    vi.clearAllMocks();
    expect(
      (
        await dailyImage(
          new Request('https://example.test/api/v1/og/daily?payload=bad&signature=bad'),
        )
      ).status,
    ).toBe(403);
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it('prevents a CDN from serving revoked shares by disabling bearer image caching', async () => {
    const response = await shareImage(
      new Request('https://example.test/api/v1/og/share/' + 'A'.repeat(22)),
      {
        params: Promise.resolve({ token: 'A'.repeat(22) }),
      },
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    mock.share.mockRejectedValue(new ApiError('E_NOT_FOUND', 'Share not found', 404));
    vi.clearAllMocks();
    expect(
      (
        await shareImage(new Request('https://example.test/api/v1/og/share/' + 'A'.repeat(22)), {
          params: Promise.resolve({ token: 'A'.repeat(22) }),
        })
      ).status,
    ).toBe(404);
    expect(mock.render).not.toHaveBeenCalled();
  });

  it('scrubs 1000 real pino lines and Sentry events containing encoded secrets and unwrapped birth fields', () => {
    let output = '';
    const logger = createLogger({
      write: (line) => {
        output += line;
      },
    });
    const pii = {
      year: 1990,
      month: 5,
      day: 15,
      hour: 8,
      minute: 30,
      place: { lat: 39.9, lng: 116.4 },
      questionText: 'private free text',
      nested: { body: { text: 'private request' }, headers: { cookie: 'private credential' } },
      url: '/callback?callbackUrl=%2Fauth%3Ftoken%3Dprivate-token%26question%3Dprivate%2520question',
      splitDateUrl: 'https://example.test/birth?year=1990&month=5&day=15&city=private-city',
      note: '1990%2D05%2D15 private%40example.com',
    };
    for (let i = 0; i < 1000; i++) logger.info(pii, 'Security sample');
    expect(output.trim().split('\n')).toHaveLength(1000);
    expect(output).not.toMatch(/1990|39\.9|116\.4|private/);
    const clean = beforeSend({
      type: undefined,
      extra: pii,
      breadcrumbs: [{ data: pii }],
      request: { data: pii },
      user: { id: 'owner', email: 'private@example.test' },
    });
    expect(JSON.stringify(clean)).not.toMatch(/1990|39\.9|116\.4|private/);
    expect(clean.user).toEqual({ id: 'owner' });
  });
});
