import { setRequestLocale } from 'next-intl/server';
import { FeatureMessages } from '@/components/feature-messages';
/** Authentication owns its message catalog without adding it to public navigation snapshots. */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FeatureMessages locale={locale}>{children}</FeatureMessages>;
}
