import { createHash, createHmac } from 'node:crypto';
import type { Locale, Plan, System } from '@prisma/client';
import { getDb } from './db';
import { getLocalRedis, getUpstashRedis } from './redis';
import { logger } from './logger';
// DESIGN-GAP: 07 names operations but no event catalog; use 06's four names plus explicit registration, activity and failure events.
export type EventName =
  | 'reading.created'
  | 'reading.failed'
  | 'daily.viewed'
  | 'share.created'
  | 'sub.started'
  | 'sub.ended'
  | 'user.registered'
  | 'user.active'
  | 'ad.impression'
  | 'chat.completed'
  | 'chat.failed'
  | 'chat.deleted'
  | 'chat.denied';
/** Return UTC day and a purpose-separated rotating pseudonym; never persist the owner ID. */
export function eventIdentity(userId?: string, now = new Date()) {
  const day = new Date(now.toISOString().slice(0, 10));
  if (!userId) return { day };
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET required for event pseudonyms');
  const salt = createHmac('sha256', process.env.AUTH_SECRET)
    .update(`event:${day.toISOString()}`)
    .digest('hex');
  return { day, userHash: createHash('sha256').update(`${userId}:${salt}`).digest('hex') };
}
/** Record only typed dimensions, update today's Redis counters, and isolate optional telemetry failures. */
export async function recordEvent(
  name: EventName,
  context: { userId?: string; system?: System; locale?: Locale; plan?: Plan } = {},
) {
  try {
    if (!process.env.DATABASE_URL) return;
    const { userId, ...dimensions } = context;
    const identity = eventIdentity(userId);
    await getDb().event.create({ data: { name, ...dimensions, ...identity } });
    await incrementEventCounter(name, identity.day);
  } catch {
    logger.warn({ name }, 'Optional event recording failed');
  }
}
/** Idempotently replace completed-day aggregates using one database snapshot and an advisory lock. */
export async function aggregateEvents(now = new Date()) {
  const cutoff = now.toISOString().slice(0, 10);
  const before = new Date(cutoff);
  return getDb().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6061)`;
      // DESIGN-GAP: Rebuild completed days to include delayed events; raw events remain available for corrections.
      await tx.eventDaily.deleteMany({ where: { day: { lt: before } } });
      // DESIGN-GAP: Bind a UTC date string explicitly; timestamp parameters otherwise depend on the database session timezone.
      return tx.$executeRaw`
      INSERT INTO "EventDaily" (id, day, name, system, locale, plan, count, uniques)
      SELECT md5(concat_ws('|', day::text, name, coalesce(system::text, ''), coalesce(locale::text, ''), coalesce(plan::text, ''))),
             day, name, system, locale, plan, count(*)::integer, count(DISTINCT "userHash")::integer
      FROM "Event" WHERE day < ${cutoff}::date GROUP BY day, name, system, locale, plan`;
    },
    { timeout: 30000 },
  );
}
/** Read today's counters without requiring the daily cron to have run. */
export async function liveEventCount(name: EventName) {
  const key = `events:${new Date().toISOString().slice(0, 10)}:${name}`;
  try {
    return (
      Number(
        process.env.UPSTASH_REDIS_REST_URL
          ? await getUpstashRedis().get(key)
          : await getLocalRedis().get(key),
      ) || 0
    );
  } catch {
    return null;
  }
}

/** Increment the current-day counter after a committed transactional event, without duplicating its database row. */
export async function incrementEventCounter(
  name: EventName,
  day = new Date(new Date().toISOString().slice(0, 10)),
) {
  const key = `events:${day.toISOString().slice(0, 10)}:${name}`;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const cache = getUpstashRedis();
      await cache.incr(key);
      await cache.expire(key, 172800);
    } else {
      const cache = getLocalRedis();
      await cache.incr(key);
      await cache.expire(key, 172800);
    }
  } catch {
    /* Database aggregates remain authoritative if live Redis counters are unavailable. */
  }
}
