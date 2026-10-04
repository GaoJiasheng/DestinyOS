import { setRequestLocale } from 'next-intl/server';
import { LocalReport } from '@/components/report/local-report';
export const metadata = { robots: { index: false, follow: false } };
/** Anonymous route renders only the authenticated device snapshot, never a server-persisted reading. */
export default async function LocalReadingPage({
  params,
}: {
  params: Promise<{ locale: string; system: string; id: string }>;
}) {
  const { locale, system, id } = await params;
  setRequestLocale(locale);
  return <LocalReport id={id} system={system} />;
}
