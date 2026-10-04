'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { listReadingsAction } from '@/app/readings/actions';
import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/catalog';
type Page = Extract<Awaited<ReturnType<typeof listReadingsAction>>, { ok: true }>['data'];
/** Load additional history pages without exposing encrypted birth information. */
export function HistoryList({ initial }: { initial: Page }) {
  const t = useCopy();
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      {!data.items.length ? (
        <p>
          {t('report.history.empty')} <Link href="/bazi/new">{t('form.birth.submit')}</Link>
        </p>
      ) : (
        <ul className="history-list">
          {data.items.map((r) => (
            <li className="report-card" key={r.id}>
              <Link href={`/${r.system}/r/${r.id}`}>
                <h2 className="type-h3">
                  {r.title
                    ? t('report.content', { text: r.title })
                    : t(`nav.${r.system}` as MessageKey)}
                </h2>
                <p className="muted">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(r.createdAt),
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
      {data.nextCursor ? (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void listReadingsAction({ cursor: data.nextCursor, limit: 20 })
              .then((result) => {
                if (result.ok)
                  setData((current) => ({
                    items: [...current.items, ...result.data.items],
                    nextCursor: result.data.nextCursor,
                  }));
                else setError(true);
              })
              .finally(() => setBusy(false));
          }}
        >
          {t('report.history.more')}
        </Button>
      ) : null}
    </>
  );
}
