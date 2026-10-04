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
import { ThemeProvider } from './theme-provider';
/** Global UI providers keep the theme and notification surface consistent. */
export function Providers({ children }: { children: ReactNode }) {
  const t = useCopy();
  const pathname = usePathname();
  const [needsImport, setNeedsImport] = useState(false);
  useEffect(() => {
    setNeedsImport(document.cookie.includes('anon_import=1'));
  }, [pathname]);
  return (
    <ThemeProvider>
      {children}
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
