'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const dismissDays = 30;
/** Saved report pages (`/{system}/r/{id}`, including on-device `/r/local/{id}`). */
const reportPath = /\/r\/[^/]+(\/[^/]+)?$/;
function storage<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}
/** Ask only once the visitor has opened a report or come back for a second visit. */
function engaged(): boolean {
  return storage(
    () =>
      localStorage.getItem('tianji-report-seen') === '1' ||
      Number(localStorage.getItem('tianji-visits')) >= 2,
    false,
  );
}
/** Defer SW registration and offer installation only when the browser supports it. */
export function InstallPrompt() {
  const t = useCopy(),
    pathname = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null),
    [ios, setIos] = useState(false),
    [hidden, setHidden] = useState(true),
    [eligible, setEligible] = useState(false);
  useEffect(() => {
    storage(() => {
      if (reportPath.test(pathname)) localStorage.setItem('tianji-report-seen', '1');
    }, undefined);
    setEligible(engaged());
  }, [pathname]);
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
    storage(() => {
      if (sessionStorage.getItem('tianji-visit-counted')) return;
      sessionStorage.setItem('tianji-visit-counted', '1');
      localStorage.setItem(
        'tianji-visits',
        String(Number(localStorage.getItem('tianji-visits')) + 1),
      );
    }, undefined);
    setEligible(engaged());
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const install = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setEligible(engaged());
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
  if (hidden || !eligible || (!event && !ios)) return null;
  const dismiss = () => {
    setHidden(true);
    // DESIGN-GAP: Installation dismissal lasts thirty days; no push subscriptions are created.
    try {
      localStorage.setItem(
        'tianji-install-dismissed',
        String(Date.now() + dismissDays * 86400_000),
      );
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
