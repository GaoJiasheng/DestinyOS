import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { DailyTarotCard } from '@/components/tarot/daily-tarot-card';
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
  if (path === 'today') {
    const session = await auth();
    return (
      <section className="tarot-page">
        <h1 className="type-h1">{t('nav.today')}</h1>
        <TarotMessages daily>
          <DailyTarotCard userId={session?.user?.id} />
        </TarotMessages>
      </section>
    );
  }
  if (['bazi', 'ziwei', 'astrology', 'vedic'].includes(path))
    return (
      <section className="status-page">
        <h1 className="type-h1">{t(key)}</h1>
        <Button asChild>
          <Link href={`/${path}/new`}>{t('form.birth.submit')}</Link>
        </Button>
      </section>
    );
  if (path === 'me')
    return (
      <section className="status-page">
        <h1 className="type-h1">{t(key)}</h1>
        <div className="hero-actions">
          <Button asChild>
            <Link href="/me/birth">{t('form.birth.title')}</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/me/history">{t('report.history')}</Link>
          </Button>
        </div>
      </section>
    );
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
