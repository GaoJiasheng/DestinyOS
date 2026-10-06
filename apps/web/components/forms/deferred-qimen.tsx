'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCopy } from '@/i18n/use-copy';
import { getQimenStateAction } from '@/app/qimen/actions';
const DivinationFlow = dynamic(() =>
  import('./divination-flow').then((module) => module.DivinationFlow),
);
/** Load route-specific engines and knowledge after the public shell has rendered. */
export function DeferredQimen() {
  const locale = useLocale();
  const t = useCopy();
  const [state, setState] = useState<Awaited<ReturnType<typeof getQimenStateAction>> | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    getQimenStateAction(locale)
      .then((value) => {
        if (live) {
          setState(value);
          setError(false);
        }
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [locale, revision]);
  if (state) return <DivinationFlow system="qimen" {...state} />;
  return (
    <section className="birth-shell">
      <h1>{t('nav.qimen')}</h1>
      <p role="status">{t(error ? 'errors.generic' : 'report.loading')}</p>
      {error ? (
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          {t('common.retry')}
        </button>
      ) : null}
    </section>
  );
}
