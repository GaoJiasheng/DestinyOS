import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { brand } from '@tianji/shared/brand';
import { routing, isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { shellMessages } from '@/i18n/client-messages';
import { Providers } from '@/components/providers';
import { Suspense } from 'react';
import { NavigationProgress } from '@/components/navigation-progress';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Starfield } from '@/components/three/starfield';
import { FontLoader } from '@/components/pwa/font-loader';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { Disclaimer } from '@/components/disclaimer';
import { SiteSettings } from '@/components/site-settings';
import { AdsProvider } from '@/components/ads/ads-provider';
import './fonts.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';

import '../globals.css';
/** Pre-render each supported locale without depending on request headers. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
/** Produce localized page metadata using the shared brand configuration. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getCopy();
  return {
    title: t('common.brandTitle', { nameZh: brand.nameZh, nameEn: brand.nameEn }),
    description: t('brand.tagline'),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/art/brand/favicon.ico', apple: '/art/brand/apple-touch-icon.png' },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: t('brand.nameEn', { name: brand.nameEn }),
      startupImage: '/art/brand/apple-launch.png',
    },
    metadataBase: new URL(`https://${brand.domain}`),
    alternates: { languages: { zh: '/zh', 'zh-TW': '/zh-TW', en: '/en' } },
    openGraph: {
      locale: locale === 'zh-TW' ? 'zh_TW' : locale,
      alternateLocale: ['zh', 'zh_TW', 'en'].filter(
        (value) => value !== (locale === 'zh-TW' ? 'zh_TW' : locale),
      ),
    },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#05070f' };
/** Localized root shell: accessible navigation, starfield, footer, toast, and first-visit dialog. */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getCopy();
  return (
    <html lang={locale} data-theme="neutral" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={shellMessages(messages)}>
          <Providers>
            <AdsProvider>
              <Starfield />
              <a href="#main" className="skip-link">
                {t('common.skip')}
              </a>
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              <Navigation />
              <main id="main" tabIndex={-1}>
                <SiteSettings>{children}</SiteSettings>
              </main>
              <Footer />
              <Disclaimer />
              <InstallPrompt />
              <FontLoader />
            </AdsProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
