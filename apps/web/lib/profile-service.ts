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
  if (isUnderThirteen(birth, locale)) throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
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
    if (!id && count >= (user.plan === 'pro' ? 20 : 3))
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
/** Delete a selected profile and associated private readings atomically; choose a surviving default. */
export async function removeProfile(
  userId: string,
  id: string,
  checks: SqlStatement[] = [],
  after: SqlStatement[] = [],
) {
  await lockOwner(getDb(), userId);
  await ownedProfile(userId, id);
  await atomicBatch([
    ...checks,
    ...guard('EXISTS (SELECT 1 FROM "BirthProfile" WHERE id=? AND "userId"=?)', id, userId),
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
