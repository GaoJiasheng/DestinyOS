import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { brand } from '@tianji/shared/brand';
import { routing, isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { Providers } from '@/components/providers';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Starfield } from '@/components/starfield';
import { Disclaimer } from '@/components/disclaimer';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import 'lxgw-wenkai-webfont/style.css';
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
    metadataBase: new URL(`https://${brand.domain}`),
    alternates: { languages: { zh: '/zh', en: '/en' } },
  };
}
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
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Starfield />
            <a href="#main" className="skip-link">
              {t('common.skip')}
            </a>
            <Navigation />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Footer />
            <Disclaimer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
