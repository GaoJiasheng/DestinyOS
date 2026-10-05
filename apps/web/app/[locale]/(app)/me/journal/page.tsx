import { auth } from '@/lib/auth';
import { currentProfile } from '@/lib/profile-service';
import { getDb } from '@/lib/db';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { JournalView } from '@/components/me/journal-view';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Private journal follows the existing multi-profile selection, with explicit unauthenticated/missing-profile states. */
export default async function JournalPage() {
  const t = await getCopy(),
    session = await auth();
  const profile = session?.user.id ? await currentProfile(session.user.id) : null;
  const user = session?.user.id
    ? await getDb().user.findUnique({ where: { id: session.user.id }, select: { tz: true } })
    : null;
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('me.journal')}</h1>
      <Link href="/today" className="text-link">
        {t('nav.today')}
      </Link>
      {!session?.user.id ? (
        <p>
          <Link href="/auth/login" className="text-link">
            {t('journal.login')}
          </Link>
        </p>
      ) : !profile ? (
        <p>
          <Link href="/me/birth" className="text-link">
            {t('daily.profileCTA')}
          </Link>
        </p>
      ) : (
        <JournalView
          key={`${profile.id}:${profile.version}`}
          profileId={profile.id}
          tz={user?.tz ?? null}
        />
      )}
    </section>
  );
}
