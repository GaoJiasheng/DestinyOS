export const dynamic = 'force-dynamic';
import { membershipEnabled } from '@/lib/membership';
import { auth } from '@/lib/auth';
import { getCopy } from '@/i18n/get-copy';
import { LocalHistory } from '@/components/report/local-history';
import { HistoryList } from '@/components/report/history-list';
import { listReadingsAction } from '@/app/readings/actions';
import { listProfilesAction } from '@/app/profiles/actions';
import { ImportBanner } from '@/components/report/import-banner';
import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { privatePageMetadata } from '@/lib/page-metadata';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.meHistory');
/** Dates follow the account (or browser-reported) time zone, never UTC by default. */
function validZone(zone: string | null | undefined) {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}
/** Owner history uses bounded server pagination and minimal report summaries. */
export default async function HistoryPage() {
  const t = await getCopy();
  const session = await auth();
  if (!session?.user?.id)
    return (
      <section className="status-page">
        <h1>{t('report.history')}</h1>
        <p>
          {t('report.history.localNote')}{' '}
          <Link href="/auth/login?callbackUrl=/me/history">{t('nav.login')}</Link>
        </p>
        <LocalHistory />
      </section>
    );
  const [result, profiles, user] = await Promise.all([
    listReadingsAction({ limit: 20, profile: 'all' }),
    listProfilesAction(),
    getDb().user.findUnique({ where: { id: session.user.id }, select: { tz: true } }),
  ]);
  const timeZone = validZone(user?.tz ?? (await cookies()).get('tz')?.value);
  return (
    <section className="history-page">
      <h1 className="type-h1">{t('report.history')}</h1>
      <ImportBanner />
      {membershipEnabled() && session.user.plan === 'free' ? (
        <p>{t('me.history.freeLimit')}</p>
      ) : null}
      {result.ok ? (
        <HistoryList
          initial={result.data}
          profiles={profiles.ok ? profiles.data.items : []}
          timeZone={timeZone}
        />
      ) : (
        <p role="alert">{t('report.error.E_INTERNAL')}</p>
      )}
    </section>
  );
}
