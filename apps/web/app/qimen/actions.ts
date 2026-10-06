'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Locale } from '@tianji/shared';
import { z } from 'zod';
/** Resolve private casting state after hydration; never embed knowledge or session state in the public page. */
export async function getQimenStateAction(requestedLocale: string) {
  const locale = z.nativeEnum(Locale).parse(requestedLocale);
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  const [{ auth }, { loadKnowledge }] = await Promise.all([
    import('@/lib/auth'),
    import('@/lib/knowledge'),
  ]);
  const [session, knowledge] = await Promise.all([auth(), loadKnowledge('qimen', locale)]);
  return { signedIn: Boolean(session), knowledge };
}
