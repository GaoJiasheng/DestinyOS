'use client';
import { StateArt } from '@/components/art/state-art';
import { useEffect } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
/** Retry recoverable route failures while retaining the localized starfield shell. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useCopy();
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);
  return (
    <section className="status-page">
      <StateArt state="error" priority />
      <h1 className="type-h1">{t('errors.generic')}</h1>
      <Button onClick={reset}>{t('common.retry')}</Button>
    </section>
  );
}
