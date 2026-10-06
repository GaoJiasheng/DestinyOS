import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
/** Feature screens receive their translations only when their route is requested. */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>;
}
