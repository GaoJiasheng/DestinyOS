'use client';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { useCopy } from '@/i18n/use-copy';
import { AnonymousImport } from './report/anonymous-import';
import { ThemeProvider } from './theme-provider';
/** Global UI providers keep the theme and notification surface consistent. */
export function Providers({ children }: { children: ReactNode }) {
  const t = useCopy();
  return (
    <ThemeProvider>
      {children}
      <AnonymousImport />
      <Toaster
        theme="dark"
        position="top-center"
        containerAriaLabel={t('common.notifications')}
        toastOptions={{ className: 'tianji-toast' }}
      />
    </ThemeProvider>
  );
}
