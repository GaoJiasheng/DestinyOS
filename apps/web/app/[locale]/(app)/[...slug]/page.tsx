import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/catalog';
const destinations: Record<string, MessageKey> = {
  today: 'nav.today',
  bazi: 'nav.bazi',
  ziwei: 'nav.ziwei',
  iching: 'nav.iching',
  qimen: 'nav.qimen',
  tarot: 'nav.tarot',
  astrology: 'nav.astrology',
  vedic: 'nav.vedic',
  learn: 'nav.learn',
  me: 'nav.me',
  pricing: 'pricing.pro.title',
  'auth/login': 'nav.login',
  about: 'legal.about',
  privacy: 'legal.privacy',
  terms: 'legal.terms',
  disclaimer: 'legal.disclaimer',
  contact: 'legal.contact',
  'iching/cast': 'nav.iching',
};
// DESIGN-GAP: Documented navigation destinations receive explicit M0 placeholders until their tasks ship.
/** Render only documented shell destinations; unknown paths still return a real 404. */
export default async function Placeholder({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const path = slug.join('/');
  const key = destinations[path];
  if (!key) notFound();
  const t = await getCopy();
  return (
    <section className="status-page">
      <p className="eyebrow">{t(key)}</p>
      <h1 className="type-h1">{t('common.comingSoon.title')}</h1>
      <p className="muted">{t('common.comingSoon.body')}</p>
      {path === 'disclaimer' ? <p className="legal-body">{t('legal.disclaimer.full')}</p> : null}
      <div className="hero-actions">
        <Button asChild>
          <Link href="/">{t('common.backHome')}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dev/tokens">{t('common.tokensLink')}</Link>
        </Button>
      </div>
    </section>
  );
}
