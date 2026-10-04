'use server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { AdPolicy } from '@/lib/ads';
/** Return only low-sensitivity ad eligibility; never send birth information to Google. */
export async function getAdPolicyAction(): Promise<AdPolicy> {
  const fallback: AdPolicy = { enabled: false, plan: 'free', underAge: false, blocked: false };
  if (process.env.FEATURE_ADS !== 'true' || !process.env.NEXT_PUBLIC_ADSENSE_CLIENT)
    return fallback;
  const blocked = (await cookies()).get('age_gate')?.value === 'blocked';
  if (blocked) return { ...fallback, blocked: true };
  const session = await auth();
  if (session?.user.plan === 'pro') return { ...fallback, plan: 'pro' };
  const profile = session?.user.id
    ? await getDb().birthProfile.findFirst({
        where: { userId: session.user.id, isCurrent: true },
        select: { birthYear: true },
      })
    : null;
  // DESIGN-GAP: Use only coarse birthYear for ad safety; all users turning 18 this year stay non-personalized until the next year.
  const age = profile ? new Date().getUTCFullYear() - profile.birthYear : null;
  return {
    enabled: age === null || age >= 13,
    plan: 'free',
    underAge: age !== null && age <= 18,
    blocked: age !== null && age < 13,
  };
}

/** Count a filled ad slot without storing visitor identity or birth information. */
export async function recordAdImpressionAction(placement: string) {
  const allowed = ['home', 'report-2-3', 'report-6-7', 'today', 'learn'];
  if (!allowed.includes(placement) || process.env.FEATURE_ADS !== 'true') return;
  try {
    const { headers } = await import('next/headers');
    const { ratelimit } = await import('@/lib/ratelimit');
    if (
      !(
        await ratelimit(
          'feedback',
          (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown',
        )
      ).success
    )
      return;
    await getDb().event.create({
      data: {
        day: new Date(new Date().toISOString().slice(0, 10)),
        name: 'ad.impression',
        props: { placement },
      },
    });
  } catch {
    /* Optional aggregate counting cannot break ad rendering. */
  }
}
