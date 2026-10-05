import { publicRouteMetadata } from '@/lib/public-seo';
import { LegalPage } from '@/components/legal-page';
import { setRequestLocale } from 'next-intl/server';
// DESIGN-GAP: The attribution page has no specified pathname; /credits is the footer destination.
/** Render the documented bilingual legal/attribution page. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage page="credits" />;
}

/** Public metadata includes the exact canonical path, alternate languages, and social template. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/credits');
}
