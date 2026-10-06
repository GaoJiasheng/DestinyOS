import { createHash, randomUUID } from 'node:crypto';
import { getDb } from './db';
import { cloudflareBindings } from './platform/cloudflare';
import { platform } from './platform/environment';
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
  // DESIGN-GAP: Chat transport allows 60 requests/hour; paid/free daily generation quotas are separate.
  chat: 60,
} as const;
export type RateLimitRoute = keyof typeof RATE_LIMITS;
export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };

const windowMs = 3_600_000;
/** Hash identities so limit keys never disclose emails or IP addresses. */
export function rateLimitKey(route: RateLimitRoute, identity: string) {
  return `rl:${route}:${createHash('sha256').update(identity.trim().toLowerCase()).digest('hex')}`;
}
/** Atomic in-memory sliding log for isolated tests, using a supplied storage map. */
export async function localRatelimit(
  storage: Map<string, number[]>,
  route: RateLimitRoute,
  identity: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const key = rateLimitKey(route, identity),
    limit = RATE_LIMITS[route];
  const hits = (storage.get(key) ?? []).filter((t) => t > now - windowMs);
  const success = hits.length < limit;
  if (success) hits.push(now);
  storage.set(key, hits);
  return {
    success,
    limit,
    remaining: Math.max(0, limit - hits.length),
    reset: (hits[0] ?? now) + windowMs,
  };
}
/** Workers burst binding plus a D1 atomic insert enforce all independent rolling hourly dimensions. */
export async function ratelimit(route: RateLimitRoute, identity: string): Promise<RateLimitResult> {
  const now = Date.now(),
    key = rateLimitKey(route, identity),
    limit = RATE_LIMITS[route];
  if (
    platform() === 'cloudflare' &&
    !(await (await cloudflareBindings()).RATE_LIMITER.limit({ key })).success
  )
    return { success: false, limit, remaining: 0, reset: now + 60000 };
  const db = getDb();
  const accepted = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "RateLimitHit" (id,key,"expiresAt") SELECT ?,?,? WHERE (SELECT count(*) FROM "RateLimitHit" WHERE key=? AND "expiresAt">?) < ? RETURNING id`,
    randomUUID(),
    key,
    now + windowMs,
    key,
    now,
    limit,
  );
  const rows = await db.$queryRawUnsafe<{ count: number; reset: number | null }[]>(
    `SELECT count(*) AS count, min("expiresAt") AS reset FROM "RateLimitHit" WHERE key=? AND "expiresAt">?`,
    key,
    now,
  );
  return {
    success: accepted.length === 1,
    limit,
    remaining: Math.max(0, limit - Number(rows[0]?.count ?? 0)),
    reset: Number(rows[0]?.reset ?? now + windowMs),
  };
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
