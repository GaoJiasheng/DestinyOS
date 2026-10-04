import { setRequestLocale } from 'next-intl/server';
import { TarotSelection } from '@/components/tarot/tarot-selection';
/** Public spread selection: no birth profile is needed. */
export default async function TarotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TarotSelection />;
}
