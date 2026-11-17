'use client';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
const AnonymousImport = dynamic(
  () => import('./report/anonymous-import').then((module) => module.AnonymousImport),
  { ssr: false },
);
import { getSettingsAction } from '@/app/me/actions';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from './theme-provider';
import { afterStream } from '@/lib/after-stream';
import { createShellStore, useShellStore } from '@/lib/shell-store';
// DESIGN-GAP: The notification host has no initial visible content; load it after hydration so navigation feedback remains inside the existing shell JS budget.
const Toaster = dynamic(() => import('sonner').then((module) => module.Toaster), {
  ssr: false,
});
const signedInStore = createShellStore(false);
/** Device-local hint that the last visit was signed in; never trusted for access, only for the first paint. */
const ACCOUNT_HINT = 'tianji-account';
/** Reuse account hydration for the navigation avatar without exposing profile data. */
export function useSignedIn() {
  return useShellStore(signedInStore);
}
/** Global UI providers keep the theme and notification surface consistent. */
export function Providers({ children }: { children: ReactNode }) {
  const t = useCopy();
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);
  // The public shell is static, so the session is only known after a round trip. A device that was
  // signed in last time starts as signed in before the first paint, instead of flashing the guest
  // navigation and the daily example; the server's answer below still decides.
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(ACCOUNT_HINT) === '1') signedInStore.set(true);
    } catch {
      // Storage may be unavailable; the round trip below settles the state.
    }
  }, []);
  useEffect(() => {
    let live = true;
    let cancelReduced = () => {};
    const update = () => {
      const value = localStorage.getItem('tianji-reduced-motion') === 'true';
      // MotionConfig is a context above the page: the switch waits for the stream, while the
      // document attribute (and the CSS that reads it) applies at once.
      cancelReduced();
      cancelReduced = afterStream(() => setReduced(value));
      document.documentElement.dataset.reducedMotion = String(value);
    };
    update();
    // DESIGN-GAP: Account hydration must not overwrite preferences edited while its request is in flight.
    const preferenceKeys = [
      'tianji-theme',
      'tianji-reduced-motion',
      'tianji-sound',
      'tianji-tz',
    ] as const;
    const before = new Map(preferenceKeys.map((key) => [key, localStorage.getItem(key)]));
    const restore = (key: (typeof preferenceKeys)[number], value: string | null) => {
      if (localStorage.getItem(key) !== before.get(key)) return;
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    };
    void getSettingsAction()
      .then((settings) => {
        if (!live) return;
        try {
          if (settings) localStorage.setItem(ACCOUNT_HINT, '1');
          else localStorage.removeItem(ACCOUNT_HINT);
        } catch {
          // The hint is an optimisation only.
        }
        signedInStore.set(Boolean(settings));
        if (!settings) return;
        restore('tianji-theme', settings.theme ?? 'auto');
        restore('tianji-reduced-motion', String(settings.reducedMotion));
        restore('tianji-sound', String(settings.soundOn));
        restore('tianji-tz', settings.tz);
        window.dispatchEvent(new Event('tianji-settings'));
      })
      .catch(() => undefined);
    window.addEventListener('tianji-settings', update);
    return () => {
      live = false;
      cancelReduced();
      window.removeEventListener('tianji-settings', update);
    };
  }, []);
  const [needsImport, setNeedsImport] = useState(false);
  useEffect(() => {
    // DESIGN-GAP: Saving an offline report sets the import cookie; defer the network-only lazy importer until reconnection so a missing chunk cannot replace the report with an error boundary.
    const updateImport = () =>
      setNeedsImport(navigator.onLine && document.cookie.includes('anon_import=1'));
    updateImport();
    window.addEventListener('online', updateImport);
    window.addEventListener('offline', updateImport);
    return () => {
      window.removeEventListener('online', updateImport);
      window.removeEventListener('offline', updateImport);
    };
  }, [pathname]);
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
      {needsImport ? <AnonymousImport /> : null}
      <Toaster
        theme="dark"
        position="top-center"
        duration={5000}
        containerAriaLabel={t('common.notifications')}
        toastOptions={{ className: 'tianji-toast' }}
      />
    </ThemeProvider>
  );
}
