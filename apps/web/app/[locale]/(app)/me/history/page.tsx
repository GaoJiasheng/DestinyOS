export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { getCopy } from '@/i18n/get-copy';
import { LocalHistory } from '@/components/report/local-history';
import { HistoryList } from '@/components/report/history-list';
import { listReadingsAction } from '@/app/readings/actions';
import { Link } from '@/i18n/navigation';
export const metadata = { robots: { index: false, follow: false } };
/** Owner history uses bounded server pagination and minimal report summaries. */
export default async function HistoryPage() {
  const t = await getCopy();
  const session = await auth();
  if (!session?.user?.id)
    return (
      <section className="status-page">
        <h1>{t('report.history')}</h1>
        <Link href="/auth/login">{t('report.history.login')}</Link>
        <LocalHistory />
      </section>
    );
  const result = await listReadingsAction({ limit: 20 });
  return (
    <section className="history-page">
      <h1 className="type-h1">{t('report.history')}</h1>
      {result.ok ? (
        <HistoryList initial={result.data} />
      ) : (
        <p role="alert">{t('report.error.E_INTERNAL')}</p>
      )}
    </section>
  );
}
