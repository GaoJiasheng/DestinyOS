import type { Reading } from '@prisma/client';
import type { BirthInput } from '@tianji/shared';
import { getDb } from './db';
import { profileBirth } from './profile-service';
import { sameNatalBirth } from './birth-compare';
import type { ReadingRequest } from './reading-schema';
async function profileChanged(
  id: string | null | undefined,
  version: number | null | undefined,
  birth: BirthInput | undefined,
) {
  // Divination readings carry a profile for history only; their result does not depend on birth facts.
  if (!id || !birth) return false;
  const profile = await getDb().birthProfile.findUnique({ where: { id } });
  if (!profile) return false;
  if (!profile.isCurrent) return true;
  if (version === profile.version) return false;
  // A newer version with the same natal facts (for example a renamed label) changes nothing in the chart.
  try {
    return !sameNatalBirth(birth, profileBirth(profile));
  } catch {
    return true;
  }
}
/** Flag a saved reading whose profile was edited afterwards in a way that changes the chart. */
export async function readingStaleProfile(
  row: Pick<Reading, 'profileId' | 'partnerProfileId' | 'profileVersion'>,
  snapshot: ReadingRequest,
) {
  return (
    (await profileChanged(row.profileId, row.profileVersion, snapshot.birth)) ||
    (await profileChanged(
      row.partnerProfileId,
      snapshot.partnerProfileVersion,
      snapshot.partnerBirth,
    ))
  );
}
