import { toDbLocale } from './db-locale';
import { createHash, createHmac } from 'node:crypto';
import type { Locale, Plan, System } from '@tianji/shared';
import { getDb } from './db';
import { atomicBatch, statement } from './db-batch';
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
/** Record only typed dimensions in D1 and isolate optional telemetry failures. */
export async function recordEvent(
  name: EventName,
  context: { userId?: string; system?: System; locale?: Locale; plan?: Plan } = {},
) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    const { userId, ...dimensions } = context;
    const identity = eventIdentity(userId);
    await getDb().event.create({
      data: {
        name,
        ...dimensions,
        locale: dimensions.locale ? toDbLocale(dimensions.locale) : undefined,
        ...identity,
      },
    });
    await incrementEventCounter(name, identity.day);
  } catch {
    logger.warn({ name }, 'Optional event recording failed');
  }
}
/** Idempotently replace completed-day aggregates using one database snapshot and an advisory lock. */
export async function aggregateEvents(now = new Date()) {
  const before = new Date(now.toISOString().slice(0, 10)).toISOString().replace('Z', '+00:00');
  await atomicBatch([
    statement('DELETE FROM "EventDaily" WHERE day < ?', before),
    statement(
      `INSERT INTO "EventDaily" (id,day,name,system,locale,plan,count,uniques)
      SELECT json_array(day,name,system,locale,plan),day,name,system,locale,plan,count(*),count(DISTINCT "userHash")
      FROM "Event" WHERE day < ? GROUP BY day,name,system,locale,plan`,
      before,
    ),
  ]);
  return getDb().eventDaily.count({ where: { day: { lt: new Date(before) } } });
}
/** Read today's counters without requiring the daily cron to have run. */
export async function liveEventCount(name: EventName) {
  try {
    return await getDb().event.count({
      where: { name, day: new Date(new Date().toISOString().slice(0, 10)) },
    });
  } catch {
    return null;
  }
}
/** D1 event rows are the authoritative live counters; no separate Redis counter is needed. */
export async function incrementEventCounter(name: EventName, day?: Date) {
  void name;
  void day;
}
