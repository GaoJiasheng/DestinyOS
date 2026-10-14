'use client';
import { useEffect, useState } from 'react';
import { createTranslator } from 'next-intl';
import messages from '@/i18n/error-messages.json';
import './globals.css';
/** Recover root failures with two translated labels and a native retry button. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // DESIGN-GAP: The failed root has no provider; resolve its URL locale with a compact build-generated catalog.
  const [locale, setLocale] = useState<'zh' | 'en' | 'zh-TW'>('zh');
  useEffect(() => {
    const requested = window.location.pathname.split('/')[1];
    if (requested === 'zh' || requested === 'en' || requested === 'zh-TW') setLocale(requested);
  }, []);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN)
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
  }, [error]);
  const t = createTranslator({ locale, messages: messages[locale] });
  return (
    <html lang={locale} data-theme="neutral">
      <body>
        <main className="status-page">
          <h1 className="type-h1">{t('errors.generic')}</h1>
          <button className="button button-primary" onClick={reset}>
            {t('common.retry')}
          </button>
        </main>
      </body>
    </html>
  );
}
