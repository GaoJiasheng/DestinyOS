'use client';
import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { refreshMembershipAction } from '@/app/billing/membership-actions';
/** Synchronize App purchases with web membership using the authenticated RevenueCat identity. */
export function RefreshMembership() {
  const t = useCopy(),
    router = useRouter();
  const [busy, start] = useTransition();
  const [result, setResult] = useState<'refreshed' | 'skipped' | 'error' | null>(null);
  return (
    <div>
      <Button
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              const response = await refreshMembershipAction();
              setResult(response.result);
              if (response.result === 'refreshed') router.refresh();
            } catch {
              setResult('error');
            }
          })
        }
      >
        {t(busy ? 'common.loading' : 'billing.refreshMembership')}
      </Button>
      {result ? (
        <p role={result === 'error' ? 'alert' : 'status'}>
          {t(
            result === 'error'
              ? 'billing.error'
              : result === 'skipped'
                ? 'billing.refreshSkipped'
                : 'billing.refreshed',
          )}
        </p>
      ) : null}
    </div>
  );
}
