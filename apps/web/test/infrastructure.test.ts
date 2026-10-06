import { describe, expect, it } from 'vitest';
import { createLogger } from '../lib/logger';
import { beforeSend } from '../lib/sentry';
import { assertRateLimit, localRatelimit, RATE_LIMITS, rateLimitKey } from '../lib/ratelimit';
import { ApiError, errorResponse } from '../lib/api-error';
import { checkHealth } from '../lib/health';
import { verificationSchema } from '../lib/auth-confirmation';
import { roleForEmail } from '../lib/auth-role';
import { magicLinkEmail } from '../lib/auth-email';

describe('telemetry privacy', () => {
  it('redacts request bodies, deeply nested fields, dates, emails, questions and errors', () => {
    let output = '';
    const log = createLogger({
      write: (line) => {
        output += line;
      },
    });
    log.info(
      {
        req: {
          body: { year: 1990 },
          headers: { authorization: 'secret-auth', cookie: 'secret-cookie' },
        },
        nested: {
          child: {
            birth: { year: 1990 },
            encBirth: 'ciphertext',
            question: 'secret-question',
            email: 'private@example.com',
          },
        },
        note: 'birthday1990-06-15',
        err: new Error('private@example.com question=secret-question'),
      },
      'Date 1990-06-15',
    );
    for (const value of [
      '1990',
      'secret-auth',
      'secret-cookie',
      'secret-question',
      'private@example.com',
      'ciphertext',
    ])
      expect(output).not.toContain(value);
    expect(JSON.parse(output) as unknown).toBeTruthy();
  });
  it('removes Sentry payloads and all user fields except id', () => {
    const source = {
      type: undefined,
      request: {
        data: { year: 1990 },
        headers: { cookie: 'secret' },
        url: '/?question=private&date=1990-06-15',
      },
      user: { id: 'u1', email: 'private@example.com', username: 'private' },
      extra: { nested: { birth: { year: 1990 } } },
      breadcrumbs: [{ message: 'private@example.com 1990-06-15' }],
    };
    const clean = beforeSend(source);
    expect(clean.user).toEqual({ id: 'u1' });
    expect(clean.request).not.toHaveProperty('data');
    expect(clean.request).not.toHaveProperty('headers');
    expect(JSON.stringify(clean)).not.toContain('1990');
    expect(JSON.stringify(clean)).not.toContain('private');
    expect(source.request.data).toEqual({ year: 1990 });
  });
});

describe('sliding-window quotas', () => {
  it.each(Object.entries(RATE_LIMITS))(
    'enforces %s at its documented limit and expires the window',
    async (route, limit) => {
      const redis = new Map<string, number[]>();
      const key = route as keyof typeof RATE_LIMITS;
      const now = Date.now();
      try {
        const results = await Promise.all(
          Array.from({ length: limit + 1 }, () => localRatelimit(redis, key, 'identity', now)),
        );
        expect(results.filter((result) => result.success)).toHaveLength(limit);
        const denied = results.find((result) => !result.success);
        if (!denied) throw new Error('Expected exhausted quota');
        let error: unknown;
        try {
          assertRateLimit(denied, now);
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(ApiError);
        if (!(error instanceof ApiError)) throw new Error('Expected API error');
        const response = errorResponse(error);
        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('3600');
        expect(await response.json()).toMatchObject({
          ok: false,
          error: { code: 'E_RATE_LIMITED', details: { retryAfter: 3600 } },
        });
        expect((await localRatelimit(redis, key, 'identity', now + 3_600_000)).success).toBe(true);
        expect((await localRatelimit(redis, key, 'other', now)).success).toBe(true);
      } finally {
        redis.clear();
      }
    },
  );
  it('never stores an email or IP in rate-limit keys', () => {
    expect(rateLimitKey('magic.email', 'Private@example.com')).not.toContain('@');
    expect(rateLimitKey('magic.email', 'Private@example.com')).toBe(
      rateLimitKey('magic.email', 'private@example.com'),
    );
  });
});

it('reports healthy and degraded dependencies without raw errors', async () => {
  const versions = { knowledgeVersion: '1.0.0', engineVersion: '1.0.0' };
  expect(await checkHealth({ db: async () => 1, redis: async () => true }, versions)).toMatchObject(
    { ok: true, db: true, redis: true },
  );
  expect(
    await checkHealth(
      {
        db: async () => {
          throw new Error('secret-password');
        },
        redis: async () => false,
      },
      versions,
    ),
  ).toEqual({ ok: false, db: false, redis: false, ...versions });
});

it('validates email verification parameters before consuming a token', () => {
  const value = { token: 'test-token-123456789', email: ' User@Example.com ', locale: 'zh' };
  expect(verificationSchema.parse(value).email).toBe('user@example.com');
  expect(verificationSchema.safeParse({ ...value, token: 'short' }).success).toBe(false);
  expect(verificationSchema.safeParse({ ...value, email: 'bad' }).success).toBe(false);
  expect(verificationSchema.safeParse({ ...value, locale: 'fr' }).success).toBe(false);
});

it('matches administrator emails exactly and renders both email languages safely', () => {
  expect(roleForEmail('Admin@Example.com', ' admin@example.com , other@example.com ')).toBe(
    'admin',
  );
  expect(roleForEmail('notadmin@example.com', 'admin@example.com')).toBe('user');
  expect(roleForEmail(null, 'admin@example.com')).toBe('user');
  const url = 'https://example.com/en/auth/verify?token=abc&email=user@example.com';
  expect(magicLinkEmail('zh', url).html).toContain('确认登录');
  expect(magicLinkEmail('en', url).html).toContain('Confirm sign-in');
  expect(magicLinkEmail('en', url).html).toContain('&amp;email=');
});
