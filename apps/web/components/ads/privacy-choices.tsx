'use client';
import { useState } from 'react';
import Script from 'next/script';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Dialog } from '@/components/ui/dialog';
/** Reopen Google's configured consent message; explain unavailable CMP without loading ads on excluded routes. */
export function PrivacyChoices({ settings = false }: { settings?: boolean }) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState(false);
  const t = useCopy();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT) {
            setOpen(true);
            return;
          }
          const fc = (window.googlefc ??= { callbackQueue: [] });
          fc.callbackQueue ??= [];
          fc.callbackQueue.push({ CONSENT_DATA_READY: () => fc.showRevocationMessage?.() });
          if (!fc.showRevocationMessage) setLoad(true);
        }}
      >
        {t(settings ? 'legal.privacyChoices.title' : 'legal.doNotSell')}
      </button>
      {load ? (
        <Script
          id="google-cmp"
          src={`https://fundingchoicesmessages.google.com/i/pub-${process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.replace('ca-pub-', '')}?ers=1`}
          strategy="afterInteractive"
          onError={() => setOpen(true)}
        />
      ) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('legal.privacyChoices.title')}
        description={t('legal.privacyChoices.body')}
      >
        <Link href="/privacy" onClick={() => setOpen(false)}>
          {t('legal.privacy')}
        </Link>
      </Dialog>
    </>
  );
}
