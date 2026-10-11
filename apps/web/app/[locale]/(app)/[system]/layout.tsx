import { setRequestLocale } from 'next-intl/server';
import { FeatureMessages } from '@/components/feature-messages';
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
