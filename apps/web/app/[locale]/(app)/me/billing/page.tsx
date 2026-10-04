import type { MessageKey } from '@/i18n/catalog';
import { getCopy } from '@/i18n/get-copy';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { Link, redirect } from '@/i18n/navigation';
import { BillingControls } from '@/components/billing/billing-controls';
import { setRequestLocale } from 'next-intl/server';
const billingStateKeys: Record<string, MessageKey> = {
  active: 'billing.state.active',
  trialing: 'billing.state.trialing',
  past_due: 'billing.state.past_due',
  canceled: 'billing.state.canceled',
  unpaid: 'billing.state.unpaid',
  incomplete: 'billing.state.incomplete',
  incomplete_expired: 'billing.state.incomplete_expired',
  paused: 'billing.state.paused',
  unknown: 'billing.state.unknown',
};
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Show the owner's synchronized plan, billing period and scheduled cancellation. */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy(),
    session = await auth();
  if (!session?.user.id) return redirect({ href: '/auth/login?callbackUrl=/me/billing', locale });
  const subscription = await getDb().subscription.findUnique({
    where: { userId: session.user.id },
  });
  // DESIGN-GAP: Portal availability needs only the secret key, independently of price configuration.
  const enabled = Boolean(process.env.STRIPE_SECRET_KEY);
  if (enabled) getStripe();
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('me.billing')}</h1>
      <div className="report-card">
        <p>{t(session.user.plan === 'pro' ? 'me.plan.pro' : 'me.plan.free')}</p>
        <p>{t(session.user.plan === 'pro' ? 'me.billing.pro' : 'me.billing.free')}</p>
        {subscription ? (
          <dl>
            <dt>{t('billing.status')}</dt>
            <dd>{t(billingStateKeys[subscription.status] ?? 'billing.state.unknown')}</dd>
            {subscription.currentPeriodEnd ? (
              <>
                <dt>{t(subscription.cancelAtPeriodEnd ? 'billing.endsAt' : 'billing.renewsAt')}</dt>
                <dd>
                  <time dateTime={subscription.currentPeriodEnd.toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(subscription.currentPeriodEnd)}
                  </time>
                </dd>
              </>
            ) : null}
            <dt>{t('billing.cancellation')}</dt>
            <dd>
              {t(subscription.cancelAtPeriodEnd ? 'billing.canceledAtEnd' : 'billing.notCanceled')}
            </dd>
          </dl>
        ) : null}
        <BillingControls
          enabled={enabled}
          initialPlan={session.user.plan}
          hasSubscription={Boolean(subscription)}
          success={(await searchParams).status === 'success'}
        />
        <Link href="/pricing">{t('billing.title')}</Link>
      </div>
    </section>
  );
}
