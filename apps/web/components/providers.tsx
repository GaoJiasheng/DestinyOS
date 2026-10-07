'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
// DESIGN-GAP: The notification host has no initial visible content; load it after hydration so navigation feedback remains inside the existing shell JS budget.
const Toaster = dynamic(() => import('sonner').then((module) => module.Toaster), {
  ssr: false,
});
const SignedInContext = createContext(false);
/** Reuse account hydration for the navigation avatar without exposing profile data. */
export function useSignedIn() {
  return useContext(SignedInContext);
}
/** Global UI providers keep the theme and notification surface consistent. */
export function Providers({ children }: { children: ReactNode }) {
  const t = useCopy();
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    const update = () => {
      const value = localStorage.getItem('tianji-reduced-motion') === 'true';
      setReduced(value);
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
        if (!live || !settings) return;
        setSignedIn(true);
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
      window.removeEventListener('tianji-settings', update);
    };
  }, []);
  const [needsImport, setNeedsImport] = useState(false);
  useEffect(() => {
    setNeedsImport(document.cookie.includes('anon_import=1'));
  }, [pathname]);
  return (
    <ThemeProvider>
      <SignedInContext.Provider value={signedIn}>
        <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
      </SignedInContext.Provider>
      {needsImport ? <AnonymousImport /> : null}
      <Toaster
        theme="dark"
        position="top-center"
        containerAriaLabel={t('common.notifications')}
        toastOptions={{ className: 'tianji-toast' }}
      />
    </ThemeProvider>
  );
}
