'use client';
import { useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '@/i18n/catalog';
import { useCopy } from '@/i18n/use-copy';
import { isLocale } from '@/i18n/routing';
import tw from '@/messages/zh-TW.json';
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';
import { Starfield } from '@/components/three/starfield';
import { Button } from '@/components/ui/button';
import './globals.css';
// DESIGN-GAP: A failed root layout has no provider; recover locale from the URL for this fallback.
/** Catch root layout failures with an independent translated shell and retry control. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);
  const [locale, setLocale] = useState<'zh' | 'en' | 'zh-TW'>('zh');
  useEffect(() => {
    const requested = window.location.pathname.split('/')[1] ?? '';
    if (isLocale(requested)) setLocale(requested);
  }, []);
  return (
    <html lang={locale} data-theme="neutral">
      <body>
        <NextIntlClientProvider
          locale={locale}
          timeZone="UTC"
          messages={toMessages(locale === 'zh-TW' ? tw : locale === 'zh' ? zh : en)}
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
