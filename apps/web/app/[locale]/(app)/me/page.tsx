import { membershipEnabled } from '@/lib/membership';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getProfileAction, listReadingsAction } from '@/app/readings/actions';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { LocalHistory } from '@/components/report/local-history';
import { LocalDisplayName, ProfileSummary } from '@/components/me/profile-summary';
import type { MessageKey } from '@/i18n/catalog';
import { MeMenu } from '@/components/me/me-menu';
import { LogoutForm } from '@/components/me/logout-form';
import { privatePageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.me');
/** Account overview with only five recent readings and owner profile derivatives. */
export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getCopy(),
    session = await auth();
  const user = session?.user.id
    ? await getDb().user.findUnique({
        where: { id: session.user.id },
        select: { name: true, image: true, plan: true },
      })
    : null;
  const profile = session?.user.id ? await getProfileAction() : null,
    history = session?.user.id ? await listReadingsAction({ limit: 5, profile: 'all' }) : null;
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('nav.me')}</h1>
      <div className="report-card">
        {user?.image ? (
          <img className="me-avatar" width="48" height="48" src={user.image} alt={t('me.avatar')} />
        ) : null}
        {user ? (
          // DESIGN-GAP: A signed-in member without a display name uses the existing authenticated-state copy.
          <h2>{user.name ? t('report.content', { text: user.name }) : t('auth.login.signedIn')}</h2>
        ) : (
          <LocalDisplayName />
        )}
        {!user ? <Link href="/auth/login?callbackUrl=/me">{t('nav.login')}</Link> : null}
        {membershipEnabled() ? (
          <p>{t(user?.plan === 'pro' ? 'me.plan.pro' : 'me.plan.free')}</p>
        ) : null}
      </div>
      <ProfileSummary
        signedIn={Boolean(user)}
        profile={profile?.ok && profile.data ? profile.data : undefined}
      />
      <section className="report-card">
        <h2>{t('me.recent')}</h2>
        {!user ? (
          <LocalHistory limit={5} />
        ) : history?.ok && history.data.items.length ? (
          <ul>
            {history.data.items.map((r) => (
              <li key={r.id}>
                <Link href={`/${r.system}/r/${r.id}`}>
                  {r.title
                    ? t('report.content', { text: r.title })
                    : t(`nav.${r.system}` as MessageKey)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('report.history.empty')}</p>
        )}
      </section>
      <MeMenu signedIn={Boolean(user)} billing={membershipEnabled()} />
      {user ? <LogoutForm locale={locale} /> : null}
    </section>
  );
}
