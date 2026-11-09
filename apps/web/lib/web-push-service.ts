import { createHash } from 'node:crypto';
import { z } from 'zod';
import { IanaTimezoneSchema } from '@tianji/shared';
import { decryptField } from './crypto';
import { getDb } from './db';
import { atomicBatch, insertRow, statement } from './db-batch';
import { ApiError } from './api-error';
import { webPushEnabled } from './web-push-flag';
import {
  base64UrlDecode,
  sendPush,
  validPushEndpoint,
  type PushResult,
  type PushTarget,
  type SendOptions,
} from './web-push';
import {
  MAX_PUSH_FAILURES,
  PUSH_BATCH_SIZE,
  PUSH_CATCHUP_HOURS,
  PUSH_LOCALES,
  PUSH_MAX_DEVICES_PER_USER,
  PUSH_MAX_PER_RUN,
  PUSH_MAX_RUN_MS,
  REMINDER_HOURS,
  localClock,
  reminderDue,
  reminderPayload,
  validTimeZone,
  type PushLocale,
  type ReminderCopy,
} from './web-push-schedule';

function decodedLength(value: string): number {
  try {
    return base64UrlDecode(value).length;
  } catch {
    return -1;
  }
}
const EndpointSchema = z.string().max(2048).refine(validPushEndpoint);
const PushSubscribeSchema = z
  .object({
    endpoint: EndpointSchema,
    p256dh: z
      .string()
      .max(128)
      .refine((value) => decodedLength(value) === 65),
    auth: z
      .string()
      .max(64)
      .refine((value) => decodedLength(value) === 16),
    tz: IanaTimezoneSchema.refine(validTimeZone),
    locale: z.enum(PUSH_LOCALES),
    hour: z
      .number()
      .int()
      .refine((hour) => REMINDER_HOURS.some((entry) => entry === hour)),
  })
  .strict();

/** Keyed by a hash so the unique index and lookups never need the plaintext endpoint. */
function endpointHash(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

export function assertWebPushEnabled(): void {
  if (!webPushEnabled()) throw new ApiError('E_FEATURE_DISABLED', 'Web push is not enabled', 403);
}

/** Create or refresh one device; re-subscribing re-enables it and cannot grant a second send that day. */
export async function savePushSubscription(userId: string, raw: unknown) {
  const input = PushSubscribeSchema.parse(raw);
  const clock = localClock(new Date(), input.tz);
  // A reminder time already behind the local clock starts tomorrow instead of firing late via catch-up.
  const claimedToday = clock.hour >= input.hour ? clock.date : null;
  await atomicBatch([
    insertRow(
      'PushSubscription',
      {
        userId,
        endpointHash: endpointHash(input.endpoint),
        encEndpoint: input.endpoint,
        encKeys: JSON.stringify({ p256dh: input.p256dh, auth: input.auth }),
        locale: input.locale,
        tz: input.tz,
        hour: input.hour,
        lastSentDate: claimedToday,
      },
      `ON CONFLICT("endpointHash") DO UPDATE SET "userId"=excluded."userId","encEndpoint"=excluded."encEndpoint","encKeys"=excluded."encKeys","locale"=excluded."locale","tz"=excluded."tz","hour"=excluded."hour","lastSentDate"=COALESCE(excluded."lastSentDate","PushSubscription"."lastSentDate"),"failureCount"=0,"disabledAt"=NULL,"updatedAt"=excluded."updatedAt"`,
    ),
    statement(
      `DELETE FROM "PushSubscription" WHERE "userId"=? AND id NOT IN (SELECT id FROM "PushSubscription" WHERE "userId"=? ORDER BY "updatedAt" DESC, id DESC LIMIT ?)`,
      userId,
      userId,
      PUSH_MAX_DEVICES_PER_USER,
    ),
  ]);
  return { subscribed: true, hour: input.hour };
}

/** Remove the caller's device; unknown endpoints and other owners' rows are ignored. */
export async function deletePushSubscription(userId: string, raw: unknown) {
  const endpoint = z.string().min(1).max(2048).parse(raw);
  await getDb().pushSubscription.deleteMany({
    where: { userId, endpointHash: endpointHash(endpoint) },
  });
  return { subscribed: false };
}

/** Report whether this browser's endpoint is an active reminder of the caller. */
export async function pushSubscriptionStatus(userId: string, raw: unknown) {
  const endpoint = z.string().min(1).max(2048).parse(raw);
  const row = await getDb().pushSubscription.findUnique({
    where: { endpointHash: endpointHash(endpoint) },
    select: { userId: true, hour: true, disabledAt: true },
  });
  return row && row.userId === userId && !row.disabledAt
    ? { subscribed: true, hour: row.hour }
    : { subscribed: false, hour: null };
}

type DueRow = {
  id: string;
  userId: string;
  encEndpoint: string;
  encKeys: string;
  locale: string;
  failureCount: number;
};
type Outcome = { row: DueRow; result: PushResult };
export type PushRunSummary = {
  claimed: number;
  sent: number;
  gone: number;
  failed: number;
  /** A ceiling stopped the run; the rest stays due for the next hourly run. */
  truncated: boolean;
};
export type PushRunOptions = {
  vapid: SendOptions['vapid'];
  copy: Record<PushLocale, ReminderCopy>;
  now?: Date;
  fetch?: typeof fetch;
  batchSize?: number;
  maxPerRun?: number;
  maxRunMs?: number;
};

/** D1 allows 100 bound parameters per statement. */
const MAX_ZONES_PER_QUERY = 80;
const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(',');

/** Zones that are inside a reminder window now, grouped by the identical local date and due hours. */
async function dueGroups(now: Date) {
  const zones = await getDb().$queryRawUnsafe<{ tz: string }[]>(
    `SELECT DISTINCT "tz" FROM "PushSubscription" WHERE "disabledAt" IS NULL`,
  );
  const groups = new Map<string, { date: string; hours: number[]; zones: string[] }>();
  for (const { tz } of zones) {
    const hours = REMINDER_HOURS.filter((hour) =>
      reminderDue(
        { timeZone: tz, hour, lastSentDate: null, disabledAt: null },
        now,
        PUSH_CATCHUP_HOURS,
      ),
    );
    if (!hours.length) continue;
    const date = localClock(now, tz).date;
    const key = `${date}|${hours.join(',')}`;
    const group = groups.get(key) ?? { date, hours, zones: [] };
    group.zones.push(tz);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Conditional UPDATE is the idempotency point: only ids returned here may be sent by this run. */
async function claim(ids: string[], date: string): Promise<Set<string>> {
  const rows = await getDb().$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "PushSubscription" SET "lastSentDate"=? WHERE id IN (${placeholders(ids)}) AND "disabledAt" IS NULL AND ("lastSentDate" IS NULL OR "lastSentDate"<>?) RETURNING id`,
    date,
    ...ids,
    date,
  );
  return new Set(rows.map((row) => row.id));
}

function target(row: DueRow): PushTarget | null {
  const endpoint = decryptField(row.encEndpoint, 'PushSubscription.encEndpoint', row.userId);
  if (!validPushEndpoint(endpoint)) return null;
  const keys = JSON.parse(decryptField(row.encKeys, 'PushSubscription.encKeys', row.userId)) as {
    p256dh: string;
    auth: string;
  };
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

async function deliver(row: DueRow, options: PushRunOptions): Promise<Outcome> {
  let resolved: PushTarget | null;
  try {
    resolved = target(row);
  } catch {
    // An unreadable row must not abort the run; it follows the failure path to disablement.
    return { row, result: { status: 'failed', code: 0 } };
  }
  if (!resolved) return { row, result: { status: 'gone' } };
  const locale = PUSH_LOCALES.find((entry) => entry === row.locale) ?? 'zh';
  const result = await sendPush(resolved, reminderPayload(locale, options.copy[locale]), {
    vapid: options.vapid,
    fetch: options.fetch,
  });
  return { row, result };
}

async function recordOutcomes(outcomes: Outcome[], now: Date) {
  const ids = (status: PushResult['status']) =>
    outcomes.filter((entry) => entry.result.status === status).map((entry) => entry.row.id);
  const gone = ids('gone');
  const failed = ids('failed');
  const recovered = outcomes
    .filter((entry) => entry.result.status === 'sent' && entry.row.failureCount > 0)
    .map((entry) => entry.row.id);
  await atomicBatch([
    ...(gone.length
      ? [statement(`DELETE FROM "PushSubscription" WHERE id IN (${placeholders(gone)})`, ...gone)]
      : []),
    ...(recovered.length
      ? [
          statement(
            `UPDATE "PushSubscription" SET "failureCount"=0 WHERE id IN (${placeholders(recovered)})`,
            ...recovered,
          ),
        ]
      : []),
    ...(failed.length
      ? [
          statement(
            `UPDATE "PushSubscription" SET "failureCount"="failureCount"+1,"disabledAt"=CASE WHEN "failureCount"+1>=? THEN ? ELSE "disabledAt" END WHERE id IN (${placeholders(failed)})`,
            MAX_PUSH_FAILURES,
            now.toISOString().replace('Z', '+00:00'),
            ...failed,
          ),
        ]
      : []),
  ]);
}

/** Send every reminder due now, within the per-run ceilings. Claim first, so at most one send per local day. */
export async function sendDueReminders(options: PushRunOptions): Promise<PushRunSummary> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? PUSH_BATCH_SIZE;
  const maxPerRun = options.maxPerRun ?? PUSH_MAX_PER_RUN;
  const deadline = Date.now() + (options.maxRunMs ?? PUSH_MAX_RUN_MS);
  const summary: PushRunSummary = { claimed: 0, sent: 0, gone: 0, failed: 0, truncated: false };
  const db = getDb();
  for (const group of await dueGroups(now)) {
    for (let offset = 0; offset < group.zones.length; offset += MAX_ZONES_PER_QUERY) {
      const zones = group.zones.slice(offset, offset + MAX_ZONES_PER_QUERY);
      let cursor = '';
      while (true) {
        const take = Math.min(batchSize, maxPerRun - summary.claimed);
        if (take <= 0 || Date.now() >= deadline) {
          summary.truncated = true;
          return summary;
        }
        const rows = await db.$queryRawUnsafe<DueRow[]>(
          `SELECT id,"userId","encEndpoint","encKeys","locale","failureCount" FROM "PushSubscription" WHERE "disabledAt" IS NULL AND "tz" IN (${placeholders(zones)}) AND "hour" IN (${placeholders(group.hours)}) AND ("lastSentDate" IS NULL OR "lastSentDate"<>?) AND id>? ORDER BY id LIMIT ?`,
          ...zones,
          ...group.hours,
          group.date,
          cursor,
          take,
        );
        const last = rows.at(-1);
        if (!last) break;
        cursor = last.id;
        const claimed = await claim(
          rows.map((row) => row.id),
          group.date,
        );
        const outcomes = await Promise.all(
          rows.filter((row) => claimed.has(row.id)).map((row) => deliver(row, options)),
        );
        summary.claimed += claimed.size;
        for (const { result } of outcomes)
          summary[
            result.status === 'sent' ? 'sent' : result.status === 'gone' ? 'gone' : 'failed'
          ] += 1;
        await recordOutcomes(outcomes, now);
        if (rows.length < take) break;
      }
    }
  }
  return summary;
}
