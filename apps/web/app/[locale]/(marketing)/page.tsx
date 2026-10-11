import { ArtImage } from '@/components/art/art-image';
import { artAssets } from '@tianji/ui-core/art';
import { publicRouteMetadata } from '@/lib/public-seo';
import { structuredJson } from '@/lib/learn';
import { AdSlot } from '@/components/ads/ad-slot';
import { brand } from '@tianji/shared/brand';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ReadingLauncher } from '@/components/navigation';
import { systems } from '@/lib/system-links';
import { HomeInsights } from '@/components/home/home-insights';
import { SystemSymbol } from '@/components/home/system-symbol';
export const revalidate = 3600;
/** The homepage canonical uses its selected BCP 47 route. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '');
}
/** Initial landing page with the brand, documented tagline, and two primary entry points. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <div className="home-layout">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: structuredJson({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `https://${brand.domain}/#website`,
                url: `https://${brand.domain}/${locale}`,
                name: brand.nameEn,
                alternateName: brand.nameZh,
                inLanguage: locale,
                publisher: { '@id': `https://${brand.domain}/#organization` },
              },
              {
                '@type': 'Organization',
                '@id': `https://${brand.domain}/#organization`,
                url: `https://${brand.domain}`,
                name: brand.nameEn,
                alternateName: brand.nameZh,
              },
            ],
          }),
        }}
      />
      <section className="home-hero">
        <ArtImage
          asset="hero/galaxy"
          {...artAssets['hero/galaxy']}
          alt={t('art.hero.galaxy')}
          className="hero-art"
          sizes="(max-width: 768px) 960px, 1920px"
          priority
        />
        <ArtImage
          asset="hero/ink-clouds"
          {...artAssets['hero/ink-clouds']}
          alt={t('art.hero.ink-clouds')}
          className="hero-ink-art"
          sizes="512px"
          // DESIGN-GAP: A 6–12% opacity cloud overlay uses the 512px derivative even on high-DPR screens; the full 2048px texture remains available to native renderers.
          maxWidth={512}
        />
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
          <a href="#systems">
            {t('home.explore')} <span aria-hidden>↓</span>
          </a>
          <span className="hero-line" />
        </div>
      </section>
      <HomeInsights />
      <section id="systems" className="home-section" aria-labelledby="systems-heading">
        <p className="eyebrow">{t('home.cards.eyebrow')}</p>
        <h2 id="systems-heading">{t('home.cards.title')}</h2>
        <div className="home-systems">
          {systems.map((system) => (
            <Link
              key={system}
              href={`/${system}`}
              className="home-system-card"
              data-home-system={system}
            >
              <SystemSymbol system={system} />
              <div>
                <h3>{t(`nav.${system}`)}</h3>
                <p className="muted">{t(`${system}.placeholder`)}</p>
                <p className="type-caption system-requirements">
                  {t(
                    ['bazi', 'ziwei', 'astrology', 'vedic', 'numerology'].includes(system)
                      ? 'home.cards.birth'
                      : system === 'synastry'
                        ? 'synastry.requiresTwo'
                        : 'home.cards.noBirth',
                  )}
                </p>
              </div>
              <span aria-hidden>↗</span>
            </Link>
          ))}
        </div>
      </section>
      <AdSlot slot="home" />
      <section className="home-section" aria-labelledby="how-heading">
        <p className="eyebrow">{t('home.how.eyebrow')}</p>
        <h2 id="how-heading">{t('home.how.title')}</h2>
        <ol className="home-steps">
          {(['chart', 'knowledge', 'report'] as const).map((step, i) => (
            <li key={step}>
              <span className="step-number" aria-hidden>
                {t('common.number', { value: i + 1 })}
              </span>
              <h3>{t(`home.how.${step}.title`)}</h3>
              <p className="muted">{t(`home.how.${step}.body`)}</p>
            </li>
          ))}
        </ol>
        <p className="home-method-note">{t('home.how.note')}</p>
      </section>
      <section className="home-section" aria-labelledby="samples-heading">
        <h2 id="samples-heading">{t('home.samples.title')}</h2>
        <p className="muted">{t('home.samples.note')}</p>
        <div
          className="home-samples"
          tabIndex={0}
          role="region"
          aria-label={t('home.samples.title')}
        >
          {(['bazi', 'astrology', 'tarot'] as const).map((system) => (
            <figure key={system} className="sample-card">
              <SystemSymbol system={system} />
              <figcaption>{t(`nav.${system}`)}</figcaption>
              <blockquote>{t(`home.samples.${system}`)}</blockquote>
              <p className="type-small muted">{t('report.disclaimer.short')}</p>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
