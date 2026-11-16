import { ownerFeaturePlan } from './membership';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { BirthInputSchema, type BirthInput, type Locale } from '@tianji/shared';
import { normalizeBirth } from '@tianji/engine/common';
import { createHash } from 'node:crypto';
import type { BirthProfile } from '@prisma/client';
import { getDb } from './db';
import { randomUUID } from 'node:crypto';
import {
  atomicBatch,
  guard,
  insertRow,
  updateRows,
  statement,
  type SqlStatement,
} from './db-batch';
import { ApiError } from './api-error';
import { isUnderThirteen } from './birth-form';
export const PROFILE_COOKIE = 'tianji_profile';
export const ProfileMetadataSchema = z.object({
  label: z.string().trim().min(1).max(80),
  relation: z.enum(['self', 'partner', 'family', 'friend', 'other']),
});
/** Decode birth facts only after ownership has been checked. */
export function profileBirth(profile: BirthProfile): BirthInput {
  return BirthInputSchema.parse({
    ...JSON.parse(profile.encBirth),
    place: profile.encPlace ? JSON.parse(profile.encPlace) : undefined,
    gender: profile.gender,
  });
}
/** Treat unavailable and foreign profile IDs identically. */
export async function ownedProfile(userId: string, id: string) {
  const row = await getDb().birthProfile.findFirst({ where: { id, userId, isCurrent: true } });
  if (!row) throw new ApiError('E_FORBIDDEN', 'Profile access denied', 403);
  return row;
}
// DESIGN-GAP: Selection is per browser in an HTTP-only cookie; validate owner on every read and fall back to default.
/** Resolve the owned active profile from the selection cookie, falling back to the default.
 * @param userId Authenticated owner identifier. */
export async function currentProfile(userId: string) {
  let selected: string | undefined;
  try {
    selected = (await cookies()).get(PROFILE_COOKIE)?.value;
  } catch {
    /* Pure service tests have no request cookies. */
  }
  if (selected) {
    const row = await getDb().birthProfile.findFirst({
      where: { id: selected, userId, isCurrent: true },
    });
    if (row) return row;
  }
  return getDb().birthProfile.findFirst({
    where: { userId, isCurrent: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}
/** Read owner access before computation; batch preconditions recheck access at commit. */
async function lockOwner(tx: ReturnType<typeof getDb>, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { plan: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw new ApiError('E_UNAUTHORIZED', 'Account unavailable', 401);
  return user;
}
/** Create or edit a stable profile identity; reports retain their own encrypted input snapshots. */
export async function saveProfile(
  userId: string,
  raw: unknown,
  metadata: unknown,
  locale: Locale,
  id?: string,
  sync?: { createId?: string; checks: SqlStatement[]; after?: SqlStatement[] },
) {
  const birth = BirthInputSchema.parse(raw),
    info = ProfileMetadataSchema.parse(metadata);
  // Only the user's own profile is age-restricted; profiles for other people may be any age.
  // Relabelling an under-13 profile as 'self' is therefore rejected like any other self entry.
  if (info.relation === 'self' && isUnderThirteen(birth, locale))
    throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
  const normalized = normalizeBirth(birth, locale);
  const { place, gender, ...input } = birth;
  const tx = getDb();
  const row = await (async () => {
    const user = await lockOwner(tx, userId);
    const existing = id
      ? await tx.birthProfile.findFirst({ where: { id, userId, isCurrent: true } })
      : null;
    if (id && !existing) throw new ApiError('E_FORBIDDEN', 'Profile access denied', 403);
    const count = await tx.birthProfile.count({ where: { userId, isCurrent: true } });
    if (!id && count >= (ownerFeaturePlan(user.plan) === 'pro' ? 20 : 3))
      throw new ApiError('E_PROFILE_LIMIT', 'Profile limit reached', 403);
    const data = {
      encBirth: JSON.stringify(input),
      encPlace: place ? JSON.stringify(place) : null,
      encName: info.label,
      label: info.label,
      relation: info.relation,
      gender,
      timeUnknown: normalized.timeUnknown,
      tz: normalized.local.tz,
      birthYear: normalized.local.year,
      chartHash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
    };
    const rowId = existing?.id ?? sync?.createId ?? randomUUID();
    const statements = [
      ...(sync?.checks ?? []),
      ...guard('EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL)', userId),
    ];
    if (existing)
      statements.push(
        ...guard(
          'EXISTS (SELECT 1 FROM "BirthProfile" WHERE id=? AND "userId"=? AND version=?)',
          rowId,
          userId,
          existing.version,
        ),
        updateRows(
          'BirthProfile',
          { ...data, userId, version: existing.version + 1 },
          'id=? AND "userId"=?',
          rowId,
          userId,
        ),
      );
    else {
      // DESIGN-GAP: Recheck the runtime tier ceiling in the same write batch; the database trigger retains the absolute twenty-profile ceiling.
      statements.push(
        ...guard(
          '(SELECT count(*) FROM "BirthProfile" WHERE "userId"=? AND "isCurrent"=1) < ?',
          userId,
          ownerFeaturePlan(user.plan) === 'pro' ? 20 : 3,
        ),
      );
      statements.push(insertRow('BirthProfile', { ...data, id: rowId, userId, isDefault: false }));
      statements.push(
        statement(
          'UPDATE "BirthProfile" SET "isDefault"=1 WHERE id=? AND NOT EXISTS (SELECT 1 FROM "BirthProfile" WHERE "userId"=? AND "isDefault"=1)',
          rowId,
          userId,
        ),
      );
    }
    try {
      await atomicBatch([...statements, ...(sync?.after ?? [])]);
    } catch (error) {
      if (String(error).includes('profile_limit'))
        throw new ApiError('E_PROFILE_LIMIT', 'Profile limit reached', 403);
      throw error;
    }
    return tx.birthProfile.findUniqueOrThrow({ where: { id: rowId } });
  })();
  return { profileId: row.id, version: row.version, warnings: normalized.warnings };
}
/** Set one owner default without changing the current browser selection. */
export async function setDefaultProfile(userId: string, id: string) {
  await lockOwner(getDb(), userId);
  await ownedProfile(userId, id);
  await atomicBatch([
    ...guard(
      'EXISTS (SELECT 1 FROM "BirthProfile" p JOIN "User" u ON p."userId"=u.id WHERE p.id=? AND u.id=? AND p."isCurrent"=1 AND u."deletedAt" IS NULL)',
      id,
      userId,
    ),
    statement('UPDATE "BirthProfile" SET "isDefault"=0 WHERE "userId"=? AND "isDefault"=1', userId),
    statement('UPDATE "BirthProfile" SET "isDefault"=1 WHERE id=? AND "userId"=?', id, userId),
  ]);
}
/** Trials the owner typed for someone else were attached to this profile before they were detached
 * at creation; their snapshot (encrypted, so filtered here rather than in SQL) says `subject: 'other'`. */
async function keptOtherReadingIds(userId: string, id: string) {
  const rows = await getDb().reading.findMany({
    where: { userId, profileId: id, partnerProfileId: null },
    select: { id: true, encInput: true },
  });
  return rows
    .filter((row) => {
      try {
        return (JSON.parse(row.encInput) as { subject?: unknown }).subject === 'other';
      } catch {
        return false;
      }
    })
    .map((row) => row.id);
}
/** Delete a selected profile and its own readings atomically; trials for someone else are kept unlinked. */
export async function removeProfile(
  userId: string,
  id: string,
  checks: SqlStatement[] = [],
  after: SqlStatement[] = [],
) {
  await lockOwner(getDb(), userId);
  await ownedProfile(userId, id);
  const kept = await keptOtherReadingIds(userId, id);
  await atomicBatch([
    ...checks,
    ...guard('EXISTS (SELECT 1 FROM "BirthProfile" WHERE id=? AND "userId"=?)', id, userId),
    // Unlink first so the delete below no longer matches them; readings made after the lookup follow the old rule.
    ...(kept.length
      ? [
          statement(
            `UPDATE "Reading" SET "profileId"=NULL WHERE "userId"=? AND "profileId"=? AND "partnerProfileId" IS NULL AND id IN (${kept.map(() => '?').join(',')})`,
            userId,
            id,
            ...kept,
          ),
        ]
      : []),
    statement(
      'DELETE FROM "Reading" WHERE "userId"=? AND ("profileId"=? OR "partnerProfileId"=?)',
      userId,
      id,
      id,
    ),
    statement('DELETE FROM "BirthProfile" WHERE id=? AND "userId"=?', id, userId),
    statement(
      'UPDATE "BirthProfile" SET "isDefault"=1 WHERE id=(SELECT id FROM "BirthProfile" WHERE "userId"=? AND "isCurrent"=1 ORDER BY "createdAt",id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "BirthProfile" WHERE "userId"=? AND "isDefault"=1)',
      userId,
      userId,
    ),
    ...after,
  ]);
}
/** Count what `removeProfile` deletes so the confirmation can name it before anything is removed. */
export async function profileDeletionImpact(userId: string, id: string) {
  await ownedProfile(userId, id);
  const db = getDb();
  const kept = await keptOtherReadingIds(userId, id);
  const readings = {
    userId,
    OR: [{ profileId: id }, { partnerProfileId: id }],
    ...(kept.length ? { id: { notIn: kept } } : {}),
  };
  const [readingCount, journals, shares] = await Promise.all([
    db.reading.count({ where: readings }),
    db.journalEntry.count({ where: { userId, profileId: id } }),
    db.shareLink.count({ where: { userId, revokedAt: null, reading: readings } }),
  ]);
  return { readings: readingCount, journals, shares, kept: kept.length };
}
