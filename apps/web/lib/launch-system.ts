import { BirthInputSchema, type Locale } from '@tianji/shared';
import { createReadingAction, getProfileAction } from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading } from './reading-schema';
/** Reuse a saved birth profile for a one-click natal reading; absent profiles go to the documented form. */
export async function launchSystem(
  system: 'bazi' | 'ziwei' | 'astrology' | 'vedic',
  locale: Locale,
): Promise<{ href: string } | { error: string }> {
  const [local, saved] = await Promise.all([
    readAnonymous().catch(() => null),
    getProfileAction().catch(() => null),
  ]);
  const birth = saved?.ok && saved.data ? saved.data : local?.profile;
  if (!birth) return { href: `/${system}/new` };
  const request = {
    system,
    locale,
    ...(saved?.ok && saved.data ? { profileId: saved.data.profileId } : {}),
    birth: BirthInputSchema.parse(
      Object.fromEntries(
        Object.entries(birth).filter(([key]) =>
          [
            'calendar',
            'year',
            'month',
            'day',
            'isLeapMonth',
            'hour',
            'minute',
            'timeUnknown',
            'place',
            'gender',
            'timeSource',
            'rectificationConfidence',
          ].includes(key),
        ),
      ),
    ),
    idempotencyKey: crypto.randomUUID(),
  };
  const began = performance.now();
  const result = await createReadingAction(request);
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, 1200 - (performance.now() - began))),
  );
  if (!result.ok) return { error: result.error.code };
  if ('readingId' in result.data && result.data.readingId)
    return { href: `/${system}/r/${result.data.readingId}` };
  const reading: LocalReading = {
    id: crypto.randomUUID(),
    system,
    request,
    createdAt: new Date().toISOString(),
    title: null,
    ...result.data,
  };
  await updateAnonymous((data) => ({
    ...data,
    profile: birth,
    readings: [reading, ...data.readings].slice(0, 50),
  }));
  return { href: `/${system}/r/local/${reading.id}` };
}
