import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../db';
import { atomicBatch, guard, insertRow, statement, updateRows } from '../db-batch';
import { ApiError } from '../api-error';
import { saveProfile, removeProfile, profileBirth } from '../profile-service';
import { saveJournalEntry } from '../journal-service';
import { persistReading, resolveBirth } from '../reading-service';
import { MobilePreferencesSchema } from '@tianji/shared';
import { assertRateLimit, ratelimit } from '../ratelimit';
import {
  profileSyncSchema,
  readingSyncSchema,
  journalSyncSchema,
  settingsSyncSchema,
  MobileSettingsSchema,
  type Resource,
} from './schema';
const tables = {
  profiles: 'BirthProfile',
  readings: 'Reading',
  journal: 'JournalEntry',
  settings: 'User',
} as const;
const cursorSchema = z
  .object({
    userId: z.string(),
    resource: z.enum(['profiles', 'readings', 'journal', 'settings']),
    sequence: z.number().int().nonnegative().safe(),
  })
  .strict();
const limitSchema = z.coerce.number().int().min(1).max(100);
function mac(value: string) {
  if (!process.env.AUTH_SECRET) throw new ApiError('E_INTERNAL', 'Sync unavailable', 503);
  return createHmac('sha256', process.env.AUTH_SECRET).update(`mobile:sync:v1:${value}`).digest();
}
function encodeCursor(userId: string, resource: Resource, sequence: number) {
  const payload = Buffer.from(JSON.stringify({ userId, resource, sequence })).toString('base64url');
  return `${payload}.${mac(payload).toString('base64url')}`;
}
function decodeCursor(value: string | null, userId: string, resource: Resource) {
  if (!value || value === '0') return 0;
  try {
    if (value.length > 1000) throw new Error();
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) throw new Error();
    const actual = Buffer.from(signature, 'base64url'),
      expected = mac(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    if (parsed.userId !== userId || parsed.resource !== resource) throw new Error();
    return parsed.sequence;
  } catch {
    throw new ApiError('E_VALIDATION', 'Invalid sync cursor', 400);
  }
}
async function record(userId: string, resource: Resource, id: string) {
  const db = getDb();
  if (resource === 'profiles') {
    const row = await db.birthProfile.findFirst({ where: { id, userId, isCurrent: true } });
    return row
      ? {
          id: row.id,
          birth: profileBirth(row),
          metadata: { label: row.label ?? row.encName ?? '', relation: row.relation },
          version: row.version,
          isDefault: row.isDefault,
        }
      : null;
  }
  if (resource === 'readings') {
    const row = await db.reading.findFirst({ where: { id, userId } });
    return row
      ? {
          id: row.id,
          request: JSON.parse(row.encInput) as unknown,
          profileId: row.profileId,
          partnerProfileId: row.partnerProfileId,
          system: row.system,
          chart: row.chart,
          reportZh: row.reportZh,
          reportEn: row.reportEn,
          schoolUsed: row.schoolUsed,
          engineVersion: row.engineVersion,
          interpretVersion: row.interpretVersion,
          knowledgeVersion: row.knowledgeVersion,
          title: row.title,
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }
  if (resource === 'journal') {
    const row = await db.journalEntry.findFirst({ where: { id, userId } });
    return row
      ? {
          id: row.id,
          profileId: row.profileId,
          date: row.date.toISOString().slice(0, 10),
          mood: row.mood,
          text: row.text,
          prediction: row.prediction,
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  return user
    ? {
        id: user.id,
        settings: MobileSettingsSchema.parse({
          locale: user.locale,
          ...MobilePreferencesSchema.parse(user.mobileSettings ?? { theme: user.theme ?? 'auto' }),
          soundOn: user.soundOn,
          reducedMotion: user.reducedMotion,
          tz: user.tz,
          name: user.name,
        }),
      }
    : null;
}
async function view(userId: string, resource: Resource, id: string) {
  const change = await getDb().mobileSyncChange.findFirst({
    where: { userId, resource, recordId: id },
    orderBy: { sequence: 'desc' },
  });
  const value = await record(userId, resource, id);
  return {
    ...(value ?? { id }),
    deleted: !value,
    updatedAt: change?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}
/** Read a bounded page of monotonic changes; cursors bind owner/resource and include tombstones from Web and cascading deletes. */
export async function getSync(userId: string, resource: Resource, query: URLSearchParams) {
  const sequence = decodeCursor(query.get('since'), userId, resource),
    limit = limitSchema.parse(query.get('limit') ?? 100);
  const db = getDb();
  const changes = await db.mobileSyncChange.findMany({
    where: { userId, resource, sequence: { gt: sequence } },
    orderBy: { sequence: 'asc' },
    take: limit,
  });
  const next = changes.at(-1)?.sequence ?? sequence;
  const ids = [...new Set(changes.map((row) => row.recordId))];
  return {
    items: await Promise.all(ids.map((id) => view(userId, resource, id))),
    cursor: encodeCursor(userId, resource, next),
    hasMore: Boolean(
      await db.mobileSyncChange.findFirst({ where: { userId, resource, sequence: { gt: next } } }),
    ),
  };
}
async function writable(userId: string, resource: Resource, id: string, updatedAt: string) {
  const table = tables[resource],
    ownerField = resource === 'settings' ? 'id' : 'userId';
  const foreign = await getDb().$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${table}" WHERE id=? AND "${ownerField}" != ?`,
    id,
    userId,
  );
  if (foreign.length || (resource === 'settings' && id !== userId))
    throw new ApiError('E_FORBIDDEN', 'Record access denied', 403);
  const current = await getDb().mobileSyncChange.findFirst({
    where: { userId, resource, recordId: id },
    orderBy: { sequence: 'desc' },
  });
  if (current && (current.deleted || Date.parse(updatedAt) <= current.updatedAt.getTime()))
    return null;
  // DESIGN-GAP: Preserve the bounded client edit timestamp in the atomic change record so offline edits compare by updatedAt; Web mutations use the server clock.
  return {
    checks: [
      ...guard('EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL)', userId),
      ...guard(
        'COALESCE((SELECT MAX(sequence) FROM "MobileSyncChange" WHERE "userId"=? AND resource=? AND "recordId"=?),0)=?',
        userId,
        resource,
        id,
        current?.sequence ?? 0,
      ),
      ...guard(
        `NOT EXISTS (SELECT 1 FROM "${table}" WHERE id=? AND "${ownerField}" != ?)`,
        id,
        userId,
      ),
    ],
    after: [
      statement(
        'UPDATE "MobileSyncChange" SET "updatedAt"=? WHERE sequence=(SELECT MAX(sequence) FROM "MobileSyncChange" WHERE "userId"=? AND resource=? AND "recordId"=?)',
        new Date(updatedAt).toISOString().replace('Z', '+00:00'),
        userId,
        resource,
        id,
      ),
    ],
  };
}
async function remove(
  userId: string,
  resource: Resource,
  id: string,
  sync: NonNullable<Awaited<ReturnType<typeof writable>>>,
) {
  const value = await record(userId, resource, id);
  if (resource === 'settings')
    throw new ApiError('E_VALIDATION', 'Settings cannot be deleted', 400);
  if (resource === 'profiles' && value) return removeProfile(userId, id, sync.checks, sync.after);
  await atomicBatch([
    ...sync.checks,
    statement(`DELETE FROM "${tables[resource]}" WHERE id=? AND "userId"=?`, id, userId),
    ...(!value
      ? [insertRow('MobileSyncChange', { userId, resource, recordId: id, deleted: true })]
      : []),
    ...sync.after,
  ]);
}
/** Merge client edits using updatedAt with atomic version guards; deletion IDs are terminal and reports are recomputed using Web services. */
export async function putSync(userId: string, resource: Resource, raw: unknown) {
  const results: unknown[] = [];
  if (resource === 'profiles') {
    for (const item of profileSyncSchema.parse(raw).items) {
      const checks = await writable(userId, resource, item.id, item.updatedAt);
      if (checks) {
        if (item.deleted) await remove(userId, resource, item.id, checks);
        else {
          const existing = await getDb().birthProfile.findFirst({
            where: { id: item.id, userId, isCurrent: true },
          });
          await saveProfile(userId, item.birth, item.metadata, item.locale, existing?.id, {
            createId: item.id,
            ...checks,
          });
        }
      }
      results.push(await view(userId, resource, item.id));
    }
  } else if (resource === 'readings') {
    for (const item of readingSyncSchema.parse(raw).items) {
      const checks = await writable(userId, resource, item.id, item.updatedAt);
      if (checks) {
        if (item.deleted) await remove(userId, resource, item.id, checks);
        else {
          const user = await getDb().user.findUniqueOrThrow({ where: { id: userId } });
          assertRateLimit(
            await ratelimit(user.plan === 'pro' ? 'reading.pro' : 'reading.free', userId),
          );
          const existing = await getDb().reading.findFirst({ where: { id: item.id, userId } });
          if (existing) {
            // DESIGN-GAP: Saved reading computation is immutable during sync; only the owner's title is editable. Regeneration remains a Web operation.
            await atomicBatch([
              ...checks.checks,
              updateRows(
                'Reading',
                { title: item.title ?? existing.title },
                'id=? AND "userId"=?',
                item.id,
                userId,
              ),
              ...checks.after,
            ]);
          } else {
            const resolved = await resolveBirth(item.request, userId);
            await persistReading(
              userId,
              resolved.req,
              item.createdAt,
              item.id,
              resolved.profile,
              checks.checks,
              item.title,
              checks.after,
            );
          }
        }
      }
      results.push(await view(userId, resource, item.id));
    }
  } else if (resource === 'journal') {
    for (const item of journalSyncSchema.parse(raw).items) {
      const checks = await writable(userId, resource, item.id, item.updatedAt);
      if (checks) {
        if (item.deleted) await remove(userId, resource, item.id, checks);
        else {
          const existing = await getDb().journalEntry.findFirst({
            where: {
              userId,
              profileId: item.entry.profileId,
              date: new Date(`${item.entry.date}T00:00:00Z`),
            },
          });
          if (existing && existing.id !== item.id)
            throw new ApiError('E_CONFLICT', 'Use the existing journal identity', 409);
          await saveJournalEntry(userId, item.entry, item.locale, { createId: item.id, ...checks });
        }
      }
      results.push(await view(userId, resource, item.id));
    }
  } else {
    for (const item of settingsSyncSchema.parse(raw).items) {
      const checks = await writable(userId, resource, item.id, item.updatedAt);
      if (checks) {
        const user = await getDb().user.findUniqueOrThrow({ where: { id: userId } });
        const {
          theme,
          dailyPushEnabled,
          dailyPushTime,
          specialDayReminders,
          widgetTheme,
          hapticsOn,
          ...web
        } = item.settings;
        // DESIGN-GAP: Native theme is scoped to the App so vedic cannot alter the Web's documented theme enum.
        const mobileSettings = MobilePreferencesSchema.parse({
          ...MobilePreferencesSchema.parse(user.mobileSettings ?? { theme: user.theme ?? 'auto' }),
          ...Object.fromEntries(
            Object.entries({
              theme,
              dailyPushEnabled,
              dailyPushTime,
              specialDayReminders,
              widgetTheme,
              hapticsOn,
            }).filter(([, value]) => value !== undefined),
          ),
        });
        await atomicBatch([
          ...checks.checks,
          updateRows('User', { ...web, mobileSettings }, 'id=? AND "deletedAt" IS NULL', userId),
          ...checks.after,
        ]);
      }
      results.push(await view(userId, resource, item.id));
    }
  }
  // DESIGN-GAP: A batch commits each item separately, with stable IDs making retries safe; clients keep their previous GET cursor until they pull the complete delta.
  return { items: results };
}
