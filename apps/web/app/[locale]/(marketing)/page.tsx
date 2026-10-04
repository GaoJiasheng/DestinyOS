import { brand } from '@tianji/shared/brand';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ReadingLauncher } from '@/components/navigation';
/** Initial landing page with the brand, documented tagline, and two primary entry points. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <section className="home-hero">
      <div className="hero-orbit" aria-hidden>
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="hero-copy">
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1 className="hero-brand">
          <span className="hero-zh">{t('brand.nameZh', { name: brand.nameZh })}</span>
          <span className="hero-en">{t('brand.nameEn', { name: brand.nameEn })}</span>
        </h1>
        <p className="hero-tagline">{t('brand.tagline')}</p>
        <p className="hero-subtitle muted">{t('home.subtitle')}</p>
        <div className="hero-actions">
          <ReadingLauncher />
          <Button variant="secondary" asChild>
            <Link href="/today">{t('home.cta.today')}</Link>
          </Button>
        </div>
      </div>
      <div className="hero-bottom">
        <span className="hero-line" />
        <span>{t('home.explore')}</span>
        <span className="hero-line" />
      </div>
    </section>
  );
}
