import { setRequestLocale } from 'next-intl/server';
import { FeatureMessages } from '@/components/feature-messages';
/** The private print route supplies the same chart/export catalog as its report screen. */
export default async function PrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // DESIGN-GAP: Standalone print routes sit outside the interactive system boundary; their private catalog must not increase public HTML/Flight payloads.
  return <FeatureMessages locale={locale}>{children}</FeatureMessages>;
}
