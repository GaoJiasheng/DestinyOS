export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getReadingAction } from '@/app/readings/actions';
import { ReportLayout } from '@/components/report/report-layout';
import { getCopy } from '@/i18n/get-copy';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
export const metadata = { robots: { index: false, follow: false } };
/** Server-render a saved snapshot with owner/public access checks and locale-specific interpretation. */
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; system: string; id: string }>;
}) {
  const { locale, system, id } = await params;
  setRequestLocale(locale);
  const result = await getReadingAction(id, locale);
  const t = await getCopy();
  if (!result.ok) {
    if (result.error.code === 'E_NOT_FOUND') notFound();
    return (
      <section className="status-page" role="alert">
        <h1 className="type-h2">
          {t(result.error.code === 'E_FORBIDDEN' ? 'report.error.E_FORBIDDEN' : 'report.missing')}
        </h1>
        <Link href="/auth/login" className="text-link">
          {t('nav.login')}
        </Link>
      </section>
    );
  }
  if (result.data.system !== system) notFound();
  const session = await auth();
  const row = await getDb().reading.findUnique({ where: { id }, select: { userId: true } });
  return (
    <ReportLayout
      reading={result.data}
      owner={row?.userId === session?.user.id}
      plan={session?.user.plan ?? 'free'}
    />
  );
}
