'use client';
import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';
import { Toaster } from 'sonner';
import { useCopy } from '@/i18n/use-copy';
const AnonymousImport = dynamic(
  () => import('./report/anonymous-import').then((module) => module.AnonymousImport),
  { ssr: false },
);
import { getSettingsAction } from '@/app/me/actions';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from './theme-provider';
/** Global UI providers keep the theme and notification surface consistent. */
export function Providers({ children }: { children: ReactNode }) {
  const t = useCopy();
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    const update = () => {
      const value = localStorage.getItem('tianji-reduced-motion') === 'true';
      setReduced(value);
      document.documentElement.dataset.reducedMotion = String(value);
    };
    update();
    void getSettingsAction()
      .then((settings) => {
        if (!live || !settings) return;
        localStorage.setItem('tianji-theme', settings.theme ?? 'auto');
        localStorage.setItem('tianji-reduced-motion', String(settings.reducedMotion));
        localStorage.setItem('tianji-sound', String(settings.soundOn));
        if (settings.tz) localStorage.setItem('tianji-tz', settings.tz);
        else localStorage.removeItem('tianji-tz');
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
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
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
