import { LegalPage } from '@/components/legal-page';
import { setRequestLocale } from 'next-intl/server';
/** Render the documented bilingual legal/attribution page. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage page="terms" />;
}
