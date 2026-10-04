'use client';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { brand } from '@tianji/shared/brand';
import { LocaleSwitch } from './locale-switch';
import { systems } from './navigation';
import { PrivacyChoices } from './ads/privacy-choices';
/** Persistent footer includes legal links, privacy choices, credits, and language control. */
export function Footer() {
  const t = useCopy();
  return (
    <footer className="site-footer">
      <div className="footer-heading">
        <Link href="/" className="brand-mark">
          <span className="brand-zh">{t('brand.nameZh', { name: brand.nameZh })}</span>
          <span className="brand-en">{t('brand.nameEn', { name: brand.nameEn })}</span>
        </Link>
        <LocaleSwitch />
      </div>
      <div className="footer-links">
        {systems.map((system) => (
          <Link key={system} href={`/${system}`}>
            {t(`nav.${system}`)}
          </Link>
        ))}
        <Link href="/learn">{t('nav.learn')}</Link>
      </div>
      <div className="footer-links legal-links">
        {(['about', 'privacy', 'terms', 'disclaimer', 'contact'] as const).map((page) => (
          <Link key={page} href={`/${page}`}>
            {t(`legal.${page}`)}
          </Link>
        ))}
        <PrivacyChoices />
        <Link href="/credits">{t('legal.attributions')}</Link>
      </div>
      <p className="type-small muted">{t('report.disclaimer.short')}</p>
      <p className="type-caption footer-note">
        <a href="https://www.geonames.org/" className="text-link">
          {t('legal.geonames')}
        </a>{' '}
        ·{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="text-link">
          {t('legal.geonamesLicense')}
        </a>
      </p>
      <p className="type-caption footer-note">
        <a href="https://github.com/lxgw/LxgwWenKai">{t('legal.fontCredits')}</a>
      </p>
      <p className="type-caption footer-note">
        <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50">{t('legal.skyCredits')}</a>
      </p>
      <p className="type-caption footer-note">{t('legal.cookieNotice')}</p>
      <p className="type-caption footer-note">
        {t('common.copyright', { year: new Date().getFullYear(), brand: brand.nameEn })}
      </p>
    </footer>
  );
}
