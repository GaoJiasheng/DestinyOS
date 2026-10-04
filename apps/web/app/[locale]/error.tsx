'use client';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
/** Retry recoverable route failures while retaining the localized starfield shell. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useCopy();
  return (
    <section className="status-page">
      <h1 className="type-h1">{t('errors.generic')}</h1>
      <Button onClick={reset}>{t('common.retry')}</Button>
    </section>
  );
}
