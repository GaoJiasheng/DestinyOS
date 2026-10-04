import { getCopy } from '@/i18n/get-copy';
import { auth } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** T-41 billing placeholder preserves the route until the payment milestone. */
export default async function BillingPage() {
  const t = await getCopy(),
    session = await auth();
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('me.billing')}</h1>
      <div className="report-card">
        <p>{t(session?.user.plan === 'pro' ? 'me.plan.pro' : 'me.plan.free')}</p>
        <ul>
          <li>{t('me.billing.free')}</li>
          <li>{t('me.billing.pro')}</li>
        </ul>
        <button type="button" disabled>
          {t('me.billing.portal')}
        </button>
        <p>{t('me.billing.soon')}</p>
        <Link href="/pricing">{t('me.billing')}</Link>
      </div>
    </section>
  );
}
