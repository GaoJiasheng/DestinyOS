'use server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/api-error';
import { runAction as run } from '@/lib/action-result';
import {
  currentProfile,
  ownedProfile,
  profileBirth,
  saveProfile,
  setDefaultProfile,
  removeProfile,
  PROFILE_COOKIE,
} from '@/lib/profile-service';
const idSchema = z.string().min(1).max(100);
async function owner() {
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  return session.user.id;
}
/** Owner-only profile menu metadata, excluding birth facts. */
export async function listProfilesAction() {
  return run(async () => {
    const userId = await owner();
    const [rows, selected, user] = await Promise.all([
      getDb().birthProfile.findMany({
        where: { userId, isCurrent: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          label: true,
          encName: true,
          relation: true,
          isDefault: true,
          version: true,
        },
      }),
      currentProfile(userId),
      getDb().user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        label: p.label ?? p.encName ?? '',
        relation: p.relation,
        isDefault: p.isDefault,
        version: p.version,
      })),
      selectedId: selected?.id ?? null,
      limit: user.plan === 'pro' ? 20 : 3,
    };
  });
}
/** Select only an owned live profile; refreshing RSC reloads daily/history/form inputs. */
export async function selectProfileAction(raw: unknown) {
  return run(async () => {
    const id = idSchema.parse(raw);
    await ownedProfile(await owner(), id);
    (await cookies()).set(PROFILE_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    revalidatePath('/[locale]', 'layout');
    return { selectedId: id };
  });
}
/** Return private birth data only for owner editing. */
export async function profileDetailAction(raw: unknown) {
  return run(async () => {
    const p = await ownedProfile(await owner(), idSchema.parse(raw));
    return { ...profileBirth(p), displayName: p.label ?? p.encName ?? '' };
  });
}
/** Validate metadata and encrypted birth facts at the boundary. */
export async function saveProfileAction(raw: unknown) {
  return run(async () => {
    const input = z
      .object({
        id: idSchema.optional(),
        birth: z.unknown(),
        metadata: z.unknown(),
        locale: z.enum(['zh', 'en', 'zh-TW']),
      })
      .strict()
      .parse(raw);
    const result = await saveProfile(
      await owner(),
      input.birth,
      input.metadata,
      input.locale,
      input.id,
    );
    revalidatePath('/[locale]', 'layout');
    return result;
  });
}
/** Change default separately from browser selection. */
export async function defaultProfileAction(raw: unknown) {
  return run(async () => {
    await setDefaultProfile(await owner(), idSchema.parse(raw));
    revalidatePath('/[locale]', 'layout');
    return { saved: true };
  });
}
/** Delete one profile and its readings; the default is replaced transactionally. */
export async function removeProfileAction(raw: unknown) {
  return run(async () => {
    await removeProfile(await owner(), idSchema.parse(raw));
    revalidatePath('/[locale]', 'layout');
    return { deleted: true };
  });
}
