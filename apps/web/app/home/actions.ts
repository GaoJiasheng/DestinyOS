'use server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { isLocale } from '@/i18n/routing';
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

/** Expose only public notices; feature quotas and circuit controls stay on the server. */
export async function getPublicSiteSettingsAction(requestedLocale: string) {
  const { siteConfig } = await import('@/lib/site-config');
  const { announcement, maintenance } = await siteConfig();
  // DESIGN-GAP: Convert announcement text on the server; importing OpenCC's full dictionary in the public client shell breaks the initial-JS budget.
  const { localeText } = await import('@tianji/shared/locale');
  const locale = isLocale(requestedLocale) ? requestedLocale : 'zh';
  return {
    announcement: { ...announcement, zh: localeText(announcement.zh, locale) },
    maintenance,
  };
}
