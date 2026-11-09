'use client';
import { useTranslations } from 'next-intl';
import type { ReadingView } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
/** Report-level notices, shown beside the summary rather than above the first screen. */
export function ReportNotices({ view, local }: { view: ReadingView; local: boolean }) {
  const t = useCopy();
  const intl = useTranslations();
  return (
    <div className="report-notices">
      {local ? (
        <aside className="notice">
          <p>{t('report.localNotice')}</p>
          <Link href="/auth/login" className="text-link">
            {t('report.loginSave')}
          </Link>
        </aside>
      ) : null}
      {view.meta.timeSource === 'rectified' ? (
        <aside className="notice" data-testid="rectification-notice">
          <p>
            {intl('rectification.reportNotice', {
              percent: Math.round((view.meta.rectificationConfidence ?? 0) * 100),
            })}
          </p>
          <Link href="/me/birth">{intl('rectification.editBirth')}</Link>
          {' · '}
          <Link href="/rectify">{intl('rectification.retry')}</Link>
        </aside>
      ) : null}
      {view.staleProfile ? <p className="notice">{t('report.stale')}</p> : null}
      {view.isPublic ? <p className="notice">{t('report.public')}</p> : null}
      {view.meta.warnings.map((w) => (
        <p className="notice" key={w.code}>
          {intl(w.messageKey)}
        </p>
      ))}
    </div>
  );
}
