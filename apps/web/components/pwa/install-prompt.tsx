'use client';
import { useEffect, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
/** Defer SW registration and offer installation only when the browser supports it. */
export function InstallPrompt() {
  const t = useCopy();
  const [event, setEvent] = useState<InstallEvent | null>(null),
    [ios, setIos] = useState(false),
    [hidden, setHidden] = useState(true);
  useEffect(() => {
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = Number(localStorage.getItem('tianji-install-dismissed')) > Date.now();
    } catch {
      /* Storage is optional. */
    }
    setHidden(!!standalone || dismissed);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const install = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const installed = () => {
      setEvent(null);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    const register = () => {
      if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
        navigator.serviceWorker
          .register('/sw.js', { scope: '/', updateViaCache: 'none' })
          .catch(() => {});
    };
    const timer = window.setTimeout(register, 3000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  if (hidden || (!event && !ios)) return null;
  const dismiss = () => {
    setHidden(true);
    // DESIGN-GAP: Installation dismissal lasts seven days; no push subscriptions are created.
    try {
      localStorage.setItem('tianji-install-dismissed', String(Date.now() + 7 * 86400_000));
    } catch {
      /* Storage is optional. */
    }
  };
  return (
    <aside className="install-prompt" aria-label={t('pwa.install')}>
      <strong>{t('pwa.install')}</strong>
      <p>{t('pwa.install.body')}</p>
      {ios && !event ? (
        <p>{t('pwa.install.ios')}</p>
      ) : (
        <button
          className="button button-primary"
          type="button"
          onClick={async () => {
            if (!event) return;
            try {
              await event.prompt();
              const choice = await event.userChoice;
              if (choice.outcome === 'accepted') setHidden(true);
              else dismiss();
            } catch {
              dismiss();
            } finally {
              setEvent(null);
            }
          }}
        >
          {t('pwa.install.action')}
        </button>
      )}
      <button type="button" className="text-link" onClick={dismiss}>
        {t('pwa.install.dismiss')}
      </button>
    </aside>
  );
}
