export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getReadingAction } from '@/app/readings/actions';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { ReportLayout } from '@/components/report/report-layout';
import { getCopy } from '@/i18n/get-copy';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { privatePageMetadata } from '@/lib/page-metadata';
export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string; system: string }>;
}) => privatePageMetadata(params, 'seo.page.report');
/** Server-render a saved snapshot with owner/public access checks and locale-specific interpretation. */
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en' | 'zh-TW'; system: string; id: string }>;
}) {
  const { locale, system, id } = await params;
  setRequestLocale(locale);
  const result = await getReadingAction(id, locale);
  const t = await getCopy();
  if (!result.ok) {
    if (result.error.code === 'E_NOT_FOUND') notFound();
    // Missing and foreign reports share one server code; the page only distinguishes signed-in state.
    const signedIn = Boolean((await auth())?.user.id);
    return (
      <section className="status-page" role="alert">
        <h1 className="type-h2">
          {t(
            !signedIn
              ? 'report.accessMissing.signedOut'
              : result.error.code === 'E_FORBIDDEN'
                ? 'report.accessMissing.title'
                : 'report.missing',
          )}
        </h1>
        {signedIn ? (
          <>
            <p>{t('report.accessMissing.body')}</p>
            <Link href="/me/history" className="text-link">
              {t('report.accessMissing.history')}
            </Link>
          </>
        ) : (
          <Link
            href={`/auth/login?${new URLSearchParams({ callbackUrl: `/${system}/r/${id}` })}`}
            className="text-link"
          >
            {t('nav.login')}
          </Link>
        )}
      </section>
    );
  }
  if (result.data.system !== system) notFound();
  const session = await auth();
  const row = await getDb().reading.findUnique({ where: { id }, select: { userId: true } });
  const report = (
    <ReportLayout
      reading={result.data}
      owner={row?.userId === session?.user.id}
      plan={session?.user.plan ?? 'free'}
    />
  );
  return system === 'tarot' ? <TarotMessages>{report}</TarotMessages> : report;
}
