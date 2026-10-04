'use client';
import { useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '@/i18n/catalog';
import { useCopy } from '@/i18n/use-copy';
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';
import { Starfield } from '@/components/starfield';
import { Button } from '@/components/ui/button';
import './globals.css';
// DESIGN-GAP: A failed root layout has no provider; recover locale from the URL for this fallback.
/** Catch root layout failures with an independent translated shell and retry control. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh');
  useEffect(() => {
    if (window.location.pathname.split('/')[1] === 'en') setLocale('en');
  }, []);
  return (
    <html lang={locale} data-theme="neutral">
      <body>
        <NextIntlClientProvider
          locale={locale}
          timeZone="UTC"
          messages={toMessages(locale === 'en' ? en : zh)}
        >
          <Starfield />
          <ErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
/** Present the localized root failure message and a retry action. */
function ErrorContent({ reset }: { reset: () => void }) {
  const t = useCopy();
  return (
    <main className="status-page">
      <h1 className="type-h1">{t('errors.generic')}</h1>
      <Button onClick={reset}>{t('common.retry')}</Button>
    </main>
  );
}
