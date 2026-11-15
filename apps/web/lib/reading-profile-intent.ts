import { z } from 'zod';
import type { BirthInput, Locale } from '@tianji/shared';
import type { BirthProfile } from '@prisma/client';
import { getCopy } from '@/i18n/get-copy';
import { ApiError } from './api-error';
import { getDb } from './db';
import { guard } from './db-batch';
import { currentProfile, saveProfile } from './profile-service';
import type { ReadingRequest } from './reading-schema';
/** Client intent that travels beside the strict reading request. */
export const ReadingIntentSchema = z
  .object({ saveAsSelf: z.boolean().optional() })
  .strict()
  .optional();
export type ReadingIntent = z.infer<typeof ReadingIntentSchema>;
const natalSystems = new Set(['bazi', 'ziwei', 'astrology', 'vedic', 'numerology']);
/** The first chart a signed-in owner draws for themselves also becomes their profile,
 * so daily, calendar and journal stop asking for birth details. Charts for someone else never do. */
export async function adoptSelfProfile(
  req: ReadingRequest,
  userId: string,
  profile: BirthProfile | undefined,
  intent: ReadingIntent,
): Promise<BirthProfile | undefined> {
  if (!intent?.saveAsSelf || profile || !req.birth || !natalSystems.has(req.system)) return profile;
  try {
    const saved = await saveProfile(
      userId,
      req.birth,
      {
        label: req.displayName || (await getCopy())('profiles.relation.self'),
        relation: 'self',
      },
      req.locale,
      undefined,
      // A concurrent first submission may already have created the profile; reuse it instead.
      {
        checks: guard(
          'NOT EXISTS (SELECT 1 FROM "BirthProfile" WHERE "userId"=? AND "isCurrent"=1)',
          userId,
        ),
      },
    );
    return await getDb().birthProfile.findUniqueOrThrow({ where: { id: saved.profileId } });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_CONFLICT')
      return (await currentProfile(userId)) ?? undefined;
    throw error;
  }
}
/** Write birth facts onto the selected profile, creating the first one when none exists.
 * With `expectedId`, refuse when the selection changed since the page loaded. */
export async function saveCurrentProfile(
  owner: string,
  birth: BirthInput,
  name: string,
  locale: Locale,
  expectedId?: string,
) {
  const current = await currentProfile(owner);
  if (expectedId && current?.id !== expectedId)
    throw new ApiError('E_CONFLICT', 'Selected profile changed', 409);
  return saveProfile(
    owner,
    birth,
    {
      label:
        name || current?.label || current?.encName || (await getCopy())('profiles.relation.self'),
      relation: current?.relation ?? 'self',
    },
    locale,
    current?.id,
  );
}
