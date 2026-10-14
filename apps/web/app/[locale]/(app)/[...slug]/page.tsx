import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
/** Unknown paths retain the localized 404; every documented destination has its own implemented route. */
export default async function UnknownPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // DESIGN-GAP: Retire unreachable M0 placeholders. Their daily-card imports were included in the homepage's fallback Flight tree and downloaded unrelated engines.
  notFound();
}
