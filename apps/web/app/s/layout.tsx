import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { NavigationProgress } from '@/components/navigation-progress';
import { isLocale } from '@/i18n/routing';
import { headers } from 'next/headers';
import { Starfield } from '@/components/three/starfield';
import { FontGlyphLoader } from '@/components/pwa/font-loader';
import { routeTheme } from '@/lib/themes';
import { publicShare } from '@/lib/share-service';
import { PublicPreferences } from '@/components/share/public-preferences';
import '../globals.css';
import '../[locale]/fonts.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
/** Public shares use the selected snapshot language for their independent root document. */
export default async function ShareLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const requested = requestHeaders.get('x-share-locale');
  const token = requestHeaders.get('x-share-token') ?? '';
  let locale: 'zh' | 'en' | 'zh-TW' = requested && isLocale(requested) ? requested : 'zh';
  let theme = routeTheme('/');
  try {
    const share = await publicShare(
      token,
      requested && isLocale(requested) ? requested : undefined,
    );
    locale = share.locale;
    // DESIGN-GAP: A public snapshot inherits its system theme because /s has no dedicated visual theme.
    theme = routeTheme(`/${share.system}`);
  } catch {
    // DESIGN-GAP: Invalid or revoked share pages use Chinese as their document-language fallback.
  }
  const messages = await getMessages({ locale });
  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider
          locale={locale}
          timeZone="UTC"
          messages={{ common: messages.common ?? {} }}
        >
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <PublicPreferences theme={theme} />
          <Starfield />
          <FontGlyphLoader revisionKey={`${token}:${locale}`} />
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
