import { publicRouteMetadata } from '@/lib/public-seo';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { TarotSelection } from '@/components/tarot/tarot-selection';
// DESIGN-GAP: Public spread selection serializes only its tarot namespace, keeping unrelated report/glossary prose out of the document.
export const revalidate = 3600;
/** Public spread selection: no birth profile is needed. */
export default async function TarotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ tarot: messages.tarot ?? {} }}>
      <TarotSelection />
    </NextIntlClientProvider>
  );
}

/** Public system entry metadata uses the documented method introduction. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/tarot');
}
