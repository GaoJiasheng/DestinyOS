import { notFound } from 'next/navigation';
import { SystemArt } from '@/components/art/system-art';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { publicRouteMetadata } from '@/lib/public-seo';
const systems = ['bazi', 'ziwei', 'astrology', 'vedic', 'numerology'] as const;
export const revalidate = 3600;
export const dynamicParams = false;
/** Pre-render the documented birth-system landing routes separately from private catch-all screens. */
export function generateStaticParams() {
  return systems.map((system) => ({ system }));
}
/** Preserve precise canonical language alternates for system introductions. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; system: string }>;
}) {
  const p = await params;
  return publicRouteMetadata(Promise.resolve(p), `/${p.system}`);
}
/** Public entry requires no profile, cookies, engine or knowledge initialization. */
export default async function SystemPage({
  params,
}: {
  params: Promise<{ locale: string; system: string }>;
}) {
  const { locale, system } = await params;
  setRequestLocale(locale);
  const key = systems.find((value) => value === system);
  if (!key) notFound();
  const t = await getCopy();
  return (
    <section className="status-page">
      <SystemArt system={key} banner priority />
      <h1 className="type-h1">{t(`nav.${key}`)}</h1>
      <Button asChild>
        <Link href={`/${key}/new`}>{t('form.birth.submit')}</Link>
      </Button>
    </section>
  );
}
