'use client';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
/** Keep administrator database failures localized without displaying exception details. */
export default function AdminError({ reset }: { reset: () => void }) {
  const t = useCopy();
  return (
    <section>
      <h1>{t('admin.error.title')}</h1>
      <p role="alert">{t('admin.error', { code: 'E_INTERNAL' })}</p>
      <Button onClick={reset}>{t('admin.retry')}</Button>
    </section>
  );
}
