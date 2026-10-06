'use client';
import { useRef, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { mobileStore } from '@/lib/app-stores';
/** Open the native store on mobile; desktop users choose a link or scan a locally generated QR. */
export function AppDownloadControls({
  stores,
}: {
  stores: { kind: 'apple' | 'google'; url: string | null; qr: string | null }[];
}) {
  const t = useCopy();
  const choices = useRef<HTMLDivElement>(null);
  const [soon, setSoon] = useState(false);
  return (
    <div>
      <p className="type-h2">{t('billing.appPrice')}</p>
      <Button
        onClick={() => {
          const kind = mobileStore(navigator.userAgent, navigator.maxTouchPoints);
          const target = stores.find((store) => store.kind === kind)?.url;
          if (target) window.location.assign(target);
          else if (kind) setSoon(true);
          else choices.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      >
        {t('billing.openInApp')}
      </Button>
      {soon ? <p role="status">{t('billing.storeSoon')}</p> : null}
      <div ref={choices} className="action-row">
        {stores.map((store) => (
          <div key={store.kind}>
            {store.url ? (
              <>
                <a href={store.url} className="button">
                  {t(store.kind === 'apple' ? 'billing.appStore' : 'billing.playStore')}
                </a>
                {store.qr ? (
                  <img
                    src={store.qr}
                    width={160}
                    height={160}
                    alt={t('billing.storeQr', {
                      store: t(store.kind === 'apple' ? 'billing.appStore' : 'billing.playStore'),
                    })}
                  />
                ) : null}
              </>
            ) : (
              <p>
                {t(store.kind === 'apple' ? 'billing.appStore' : 'billing.playStore')} ·{' '}
                {t('billing.storeSoon')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
