'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { rerunWithCurrentProfileAction } from '@/app/readings/actions';
import {
  SHARE_OPEN_EVENT,
  SHARE_PUBLIC_EVENT,
  type SharePublicDetail,
} from '@/components/share/share-links';
import type { MessageKey } from '@/i18n/catalog';
import type { ReadingView } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { LoginLink } from '@/components/auth/login-link';
/** Report-level notices, shown beside the summary rather than above the first screen. */
export function ReportNotices({ view, local }: { view: ReadingView; local: boolean }) {
  const t = useCopy();
  const intl = useTranslations();
  const [isPublic, setPublic] = useState(Boolean(view.isPublic));
  useEffect(() => {
    setPublic(Boolean(view.isPublic));
    const update = (event: Event) => {
      const detail = (event as CustomEvent<SharePublicDetail>).detail;
      if (detail?.readingId === view.id) setPublic(detail.isPublic);
    };
    window.addEventListener(SHARE_PUBLIC_EVENT, update);
    return () => window.removeEventListener(SHARE_PUBLIC_EVENT, update);
  }, [view.id, view.isPublic]);
  return (
    <div className="report-notices">
      {local ? (
        <aside className="notice">
          <p>{t('report.localNotice')}</p>
          <LoginLink className="text-link">{t('report.loginSave')}</LoginLink>
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
      {view.staleProfile && !local ? <StaleNotice view={view} /> : null}
      {isPublic && !local ? (
        <aside className="notice">
          <p>{t('report.public')}</p>
          <Button
            variant="ghost"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(SHARE_OPEN_EVENT, { detail: { readingId: view.id } }),
              )
            }
          >
            {t('report.shareLinks.manage')}
          </Button>
        </aside>
      ) : null}
      {view.meta.warnings.map((w) => (
        <p className="notice" key={w.code}>
          {intl(w.messageKey)}
        </p>
      ))}
    </div>
  );
}
/** Profile edits after a reading leave it as it was; offer a fresh run from the profile's current facts. */
function StaleNotice({ view }: { view: ReadingView }) {
  const t = useCopy();
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <aside className="notice">
      <p>{t('report.stale')}</p>
      <Button
        variant="secondary"
        action={async () => {
          setError('');
          const result = await rerunWithCurrentProfileAction(
            view.id,
            locale === 'en' ? 'en' : locale === 'zh-TW' ? 'zh-TW' : 'zh',
          ).catch(() => null);
          if (result?.ok && 'readingId' in result.data && result.data.readingId)
            router.push(`/${view.system}/r/${result.data.readingId}`);
          else setError(`report.error.${result && !result.ok ? result.error.code : 'E_INTERNAL'}`);
        }}
      >
        {t('report.staleRerun')}
      </Button>
      {error ? <p role="alert">{t(error as MessageKey)}</p> : null}
    </aside>
  );
}
