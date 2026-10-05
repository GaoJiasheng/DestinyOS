import { publicRouteMetadata } from '@/lib/public-seo';
import { setRequestLocale } from 'next-intl/server';
import { TarotSelection } from '@/components/tarot/tarot-selection';
/** Public spread selection: no birth profile is needed. */
export default async function TarotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TarotSelection />;
}

/** Public system entry metadata uses the documented method introduction. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/tarot');
}
