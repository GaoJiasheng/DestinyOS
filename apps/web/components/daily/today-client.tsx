'use client';
import { useEffect, useState, useTransition } from 'react';
import { useSignedIn } from '@/components/providers';
import { todayContextAction } from '@/app/today/actions';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { TodayView } from './today-view';
/** Keep the public shell instant, loading authenticated context through an uncached Action. */
export function TodayClient() {
  const signedIn = useSignedIn();
  const t = useCopy();
  const [context, setContext] = useState<Awaited<ReturnType<typeof todayContextAction>>>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    start(async () => {
      try {
        const result = await todayContextAction();
        if (live) {
          setContext(result);
          setError(false);
        }
      } catch {
        if (live) setError(true);
      }
    });
    return () => {
      live = false;
    };
  }, [signedIn, retry]);
  if (signedIn && error)
    return (
      <div role="alert">
        {t('report.error.E_INTERNAL')}
        <Button disabled={pending} onClick={() => setRetry((n) => n + 1)}>
          {t('common.retry')}
        </Button>
      </div>
    );
  if (signedIn && (pending || !context)) return <RouteSkeleton kind="daily" />;
  return (
    <TodayView
      key={context ? `${context.profileId}:${context.version}` : 'local'}
      signedIn={signedIn}
      profileId={context?.profileId}
      tz={context?.tz}
      plan={context?.plan ?? 'free'}
      vedicUsed={context?.vedicUsed ?? false}
      panchangDefaultOpen={context?.panchangDefaultOpen}
    />
  );
}
