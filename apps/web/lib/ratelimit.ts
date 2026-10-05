import { createHash, randomUUID } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import type IORedis from 'ioredis';
import { getLocalRedis, getUpstashRedis } from './redis';
import { ApiError } from './api-error';

export const RATE_LIMITS = {
  'reading.anon': 20,
  'reading.free': 60,
  'reading.pro': 200,
  daily: 120,
  share: 30,
  export: 10,
  'magic.email': 5,
  'magic.ip': 20,
  feedback: 30,
} as const;
export type RateLimitRoute = keyof typeof RATE_LIMITS;
export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };
const limiters = new Map<RateLimitRoute, Ratelimit>();
const windowMs = 3_600_000;
// DESIGN-GAP: Local compose Redis uses an atomic sliding log; production uses Upstash's sliding window.
const slidingLog = `
local key, now, window, cap, member = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = now + window
if #oldest > 0 then reset = tonumber(oldest[2]) + window end
if count >= cap then return {0, 0, reset} end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, cap - count - 1, reset}
`;

/** Redis cache keys contain a digest of the identity, never plaintext emails or IPs. */
export function rateLimitKey(route: RateLimitRoute, identity: string): string {
  return `rl:${route}:${createHash('sha256').update(identity.trim().toLowerCase()).digest('hex')}`;
}

/** Atomically check a one-hour local Redis sliding log; accepts an injected Redis test substitute. */
export async function localRatelimit(
  redis: Pick<IORedis, 'eval'>,
  route: RateLimitRoute,
  identity: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const result = await redis.eval(
    slidingLog,
    1,
    rateLimitKey(route, identity),
    now,
    windowMs,
    RATE_LIMITS[route],
    randomUUID(),
  );
  if (!Array.isArray(result) || result.length !== 3) throw new Error('Invalid rate limit response');
  return {
    success: Number(result[0]) === 1,
    limit: RATE_LIMITS[route],
    remaining: Number(result[1]),
    reset: Number(result[2]),
  };
}

/** Check the documented per-route quota, using Upstash in production or compose Redis locally. */
export async function ratelimit(route: RateLimitRoute, identity: string): Promise<RateLimitResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return localRatelimit(getLocalRedis(), route, identity);
  let limiter = limiters.get(route);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getUpstashRedis(),
      limiter: Ratelimit.slidingWindow(RATE_LIMITS[route], '1 h'),
      prefix: `rl:${route}`,
      analytics: false,
    });
    limiters.set(route, limiter);
  }
  const result = await limiter.limit(
    createHash('sha256').update(identity.trim().toLowerCase()).digest('hex'),
  );
  // DESIGN-GAP: Upstash reports success on timeout by default; infrastructure failures must fail closed.
  if (result.reason === 'timeout')
    throw new ApiError('E_INTERNAL', 'Rate limit service unavailable', 503);
  return result;
}

/** Throw the standard 429 error with retryAfter in seconds when a quota is exhausted. */
export function assertRateLimit(result: RateLimitResult, now = Date.now()): void {
  if (!result.success)
    throw new ApiError('E_RATE_LIMITED', 'Rate limit exceeded', 429, {
      retryAfter: Math.max(1, Math.ceil((result.reset - now) / 1000)),
    });
}

/** Enforce both independent magic-link quotas; neither identity is stored in plaintext. */
export async function limitMagicLink(email: string, ip: string): Promise<void> {
  const [byEmail, byIp] = await Promise.all([
    ratelimit('magic.email', email),
    ratelimit('magic.ip', ip),
  ]);
  assertRateLimit(byEmail);
  assertRateLimit(byIp);
}
