import { publicRouteMetadata } from '@/lib/public-seo';
import { brand } from '@tianji/shared';
import { getCopy } from '@/i18n/get-copy';
import { billingEnabled } from '@/lib/stripe';
import { PricingControls } from '@/components/billing/billing-controls';
import { Link } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
export const dynamic = 'force-dynamic';
/** Localized free/pro comparison, recurrence terms, interval switch and Checkout entry. */
export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('billing.title')}</h1>
      <div className="pricing-grid">
        <section className="report-card">
          <h2>{t('me.plan.free')}</h2>
          <p>{t('billing.freePrice')}</p>
          <p>{t('billing.freeFeatures')}</p>
          <Link href="/">{t('home.cta.start')}</Link>
        </section>
        <section className="report-card">
          <h2>
            {t('pricing.pro.title', { brand: locale !== 'en' ? brand.nameZh : brand.nameEn })}
          </h2>
          <p>{t('billing.proFeatures')}</p>
          <p>{t('billing.futureFeatures')}</p>
          <PricingControls enabled={billingEnabled()} />
        </section>
      </div>
      <p>{t('billing.renewal')}</p>
      <Link href="/terms">{t('legal.terms')}</Link>
      <h2>{t('billing.faq')}</h2>
      {(['features', 'cancel', 'refund', 'payments'] as const).map((key) => (
        <details key={key}>
          <summary>{t(`billing.faq.${key}.question`)}</summary>
          <p>{t(`billing.faq.${key}.answer`)}</p>
        </details>
      ))}
    </section>
  );
}

/** Public metadata includes the exact canonical path, alternate languages, and social template. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/pricing');
}
