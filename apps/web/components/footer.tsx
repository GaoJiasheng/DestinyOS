'use client';
import { useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { brand } from '@tianji/shared/brand';
import { LocaleSwitch } from './locale-switch';
import { systems } from './navigation';
import { Dialog } from './ui/dialog';
/** Persistent footer includes legal links, privacy choices, credits, and language control. */
export function Footer() {
  const t = useCopy();
  const [privacyOpen, setPrivacyOpen] = useState(false);
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
        <button type="button" onClick={() => setPrivacyOpen(true)}>
          {t('legal.doNotSell')}
        </button>
        <Link href="/about#credits">{t('legal.attributions')}</Link>
      </div>
      <p className="type-small muted">{t('report.disclaimer.short')}</p>
      <p className="type-caption footer-note">{t('legal.cookieNotice')}</p>
      <p className="type-caption footer-note">
        {t('common.copyright', { year: new Date().getFullYear(), brand: brand.nameEn })}
      </p>
      <Dialog
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
        title={t('legal.privacyChoices.title')}
        description={t('legal.privacyChoices.body')}
      >
        <Link href="/privacy" className="text-link" onClick={() => setPrivacyOpen(false)}>
          {t('legal.privacy')}
        </Link>
      </Dialog>
    </footer>
  );
}
