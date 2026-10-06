'use client';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import {
  createCheckoutSessionAction,
  createPortalSessionAction,
  getBillingAction,
} from '@/app/billing/actions';

/** Toggle documented monthly/lifetime billing and redirect to hosted Checkout. */
export function PricingControls({ enabled }: { enabled: boolean }) {
  const t = useCopy();
  const router = useRouter();
  const [price, setPrice] = useState<'monthly' | 'lifetime'>('monthly');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <div>
      <div className="action-row" role="group" aria-label={t('billing.interval')}>
        {(['monthly', 'lifetime'] as const).map((p) => (
          <Button
            key={p}
            variant={price === p ? 'default' : 'secondary'}
            aria-pressed={price === p}
            onClick={() => setPrice(p)}
          >
            {t(`billing.${p}`)}
          </Button>
        ))}
      </div>
      <p className="type-h2">
        {t(price === 'monthly' ? 'billing.monthlyPrice' : 'billing.lifetimePrice')}
      </p>
      {enabled ? (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(false);
            void createCheckoutSessionAction({ price })
              .then((result) => {
                if (result.ok) window.location.assign(result.data.url);
                else if (result.error.code === 'E_UNAUTHORIZED')
                  router.push('/auth/login?callbackUrl=/pricing');
                else setError(true);
              })
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          {t(
            busy
              ? 'common.loading'
              : price === 'lifetime'
                ? 'billing.buyLifetime'
                : 'billing.subscribe',
          )}
        </Button>
      ) : (
        <p role="status">{t('billing.soon')}</p>
      )}
      {error ? <p role="alert">{t('billing.error')}</p> : null}
    </div>
  );
}
/** Poll plan for at most ten seconds after Checkout and open the authenticated customer portal. */
export function BillingControls({
  success,
  hasSubscription,
  enabled,
  initialPlan,
  initialLifetime,
  lifetimePurchase,
}: {
  success: boolean;
  hasSubscription: boolean;
  enabled: boolean;
  initialPlan: 'free' | 'pro';
  initialLifetime: boolean;
  lifetimePurchase: boolean;
}) {
  const t = useCopy(),
    router = useRouter();
  const [state, setState] = useState<'pending' | 'ready' | 'delayed'>(
    success && (lifetimePurchase ? !initialLifetime : initialPlan !== 'pro') ? 'pending' : 'ready',
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!success) return;
    if (lifetimePurchase ? initialLifetime : initialPlan === 'pro') {
      setState('ready');
      return;
    }
    let active = true;
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await getBillingAction();
        if (!active) return;
        if (result.ok && (lifetimePurchase ? result.data.lifetime : result.data.plan === 'pro')) {
          setState('ready');
          router.refresh();
          return;
        }
        if (Date.now() - start >= 10000) {
          setState('delayed');
          return;
        }
        timer = setTimeout(() => {
          void poll();
        }, 1000);
      } catch {
        if (active) setState('delayed');
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [success, initialPlan, initialLifetime, lifetimePurchase, router]);
  return (
    <div>
      {success ? (
        <p role="status">
          {t(
            state === 'pending'
              ? 'billing.activating'
              : state === 'delayed'
                ? 'billing.delayed'
                : 'billing.activated',
          )}
        </p>
      ) : null}
      {state === 'delayed' ? (
        <Button onClick={() => router.refresh()}>{t('common.retry')}</Button>
      ) : null}
      {hasSubscription ? (
        <Button
          disabled={!enabled || busy}
          onClick={() => {
            setBusy(true);
            setError(false);
            void createPortalSessionAction()
              .then((r) => {
                if (r.ok) window.location.assign(r.data.url);
                else setError(true);
              })
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          {t('me.billing.portal')}
        </Button>
      ) : null}
      {!enabled ? <p>{t('billing.soon')}</p> : null}
      {error ? <p role="alert">{t('billing.error')}</p> : null}
    </div>
  );
}
