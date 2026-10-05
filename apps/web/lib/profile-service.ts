import { cookies } from 'next/headers';
import { z } from 'zod';
import { BirthInputSchema, type BirthInput, type Locale } from '@tianji/shared';
import { normalizeBirth } from '@tianji/engine/common';
import { createHash } from 'node:crypto';
import type { BirthProfile } from '@prisma/client';
import { getDb } from './db';
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
/** Serialize quota and default changes on the user row, including concurrent browser requests. */
async function lockOwner(
  tx: Omit<
    ReturnType<typeof getDb>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`;
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
) {
  const birth = BirthInputSchema.parse(raw),
    info = ProfileMetadataSchema.parse(metadata);
  if (isUnderThirteen(birth, locale)) throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
  const normalized = normalizeBirth(birth, locale);
  const { place, gender, ...input } = birth;
  const row = await getDb().$transaction(async (tx) => {
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
    return existing
      ? tx.birthProfile.update({
          where: { id: existing.id, userId },
          data: { ...data, version: { increment: 1 } },
        })
      : tx.birthProfile.create({ data: { ...data, userId, isDefault: count === 0 } });
  });
  return { profileId: row.id, version: row.version, warnings: normalized.warnings };
}
/** Set one owner default without changing the current browser selection. */
export async function setDefaultProfile(userId: string, id: string) {
  await getDb().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const row = await tx.birthProfile.findFirst({ where: { id, userId, isCurrent: true } });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Profile access denied', 403);
    await tx.birthProfile.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.birthProfile.update({ where: { id, userId }, data: { isDefault: true } });
  });
}
/** Delete only the selected profile and both sides' associated private readings; cascade invalidates shares. */
export async function removeProfile(userId: string, id: string) {
  await getDb().$transaction(async (tx) => {
    await lockOwner(tx, userId);
    const row = await tx.birthProfile.findFirst({ where: { id, userId, isCurrent: true } });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Profile access denied', 403);
    // DESIGN-GAP: A second profile reference is persisted for paired history and deletion without decrypting every reading.
    await tx.reading.deleteMany({
      where: { userId, OR: [{ profileId: id }, { partnerProfileId: id }] },
    });
    await tx.birthProfile.delete({ where: { id, userId } });
    if (row.isDefault) {
      const next = await tx.birthProfile.findFirst({
        where: { userId, isCurrent: true },
        orderBy: { createdAt: 'asc' },
      });
      if (next)
        await tx.birthProfile.update({ where: { id: next.id, userId }, data: { isDefault: true } });
    }
  });
}
