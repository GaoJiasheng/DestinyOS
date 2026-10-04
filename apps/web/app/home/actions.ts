'use server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
/** Return only the signed-in user's motion preference, never a public cache payload. */
export async function getMotionPreferenceAction(): Promise<boolean> {
  const session = await auth();
  if (!session?.user.id) return false;
  return (
    (
      await getDb().user.findUnique({
        where: { id: session.user.id },
        select: { reducedMotion: true },
      })
    )?.reducedMotion ?? false
  );
}
