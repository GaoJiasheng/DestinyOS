import { getMessages, setRequestLocale } from 'next-intl/server';
import { SynastryClient } from '@/components/forms/synastry-client';
import { NextIntlClientProvider } from 'next-intl';
import { featureMessages } from '@/i18n/feature-messages';
import { publicRouteMetadata } from '@/lib/public-seo';
import {
  SYSTEM_TOOL_ANCHOR,
  SystemLandingBody,
  SystemLandingHero,
} from '@/components/landing/system-landing';
export const revalidate = 3600;
/** Pre-render the public shell, resolving owned paired inputs only after hydration. */
export default async function SynastryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SystemLandingHero locale={locale} system="synastry" startHref={`#${SYSTEM_TOOL_ANCHOR}`} />
      <div id={SYSTEM_TOOL_ANCHOR}>
        <NextIntlClientProvider messages={featureMessages(await getMessages())}>
          <SynastryClient />
        </NextIntlClientProvider>
      </div>
      <SystemLandingBody locale={locale} system="synastry" />
    </>
  );
}
/** The synastry entry is public now that the page carries its own introduction. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/synastry');
}
