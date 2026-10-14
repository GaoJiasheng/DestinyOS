import { SystemArt } from '@/components/art/system-art';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { SynastryClient } from '@/components/forms/synastry-client';
import { NextIntlClientProvider } from 'next-intl';
import { featureMessages } from '@/i18n/feature-messages';
export const revalidate = 3600;
export const metadata = { robots: { index: false, follow: false } };
/** Pre-render the public shell, resolving owned paired inputs only after hydration. */
export default async function SynastryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SystemArt system="synastry" banner priority />
      <NextIntlClientProvider messages={featureMessages(await getMessages())}>
        <SynastryClient />
      </NextIntlClientProvider>
    </>
  );
}
