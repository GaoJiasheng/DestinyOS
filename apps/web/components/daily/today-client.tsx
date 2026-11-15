'use client';
import { useEffect, useState, useTransition } from 'react';
import { useSignedIn } from '@/components/providers';
import { todayContextAction } from '@/app/today/actions';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
// DESIGN-GAP: Full viewport prefetch may parse the daily shell, but its engine/UI only downloads when the page mounts.
const TodayView = dynamic(() => import('./today-view').then((module) => module.TodayView), {
  ssr: false,
  loading: () => <RouteSkeleton kind="daily" />,
});
/** Keep the public shell instant, loading authenticated context through an uncached Action. */
export function TodayClient() {
  const signedIn = useSignedIn();
  const locale = useLocale();
  const t = useCopy();
  // undefined = not loaded yet; null = the server no longer sees a session (e.g. just signed out).
  const [context, setContext] = useState<Awaited<ReturnType<typeof todayContextAction>>>();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const changed = () => setRetry((value) => value + 1);
    window.addEventListener('tianji:profile-changed', changed);
    return () => window.removeEventListener('tianji:profile-changed', changed);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    start(async () => {
      try {
        const result = await todayContextAction(locale);
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
  }, [signedIn, retry, locale]);
  const account = signedIn && context !== null;
  if (account && error)
    return (
      <div role="alert">
        {t('report.error.E_INTERNAL')}
        <Button disabled={pending} onClick={() => setRetry((n) => n + 1)}>
          {t('common.retry')}
        </Button>
      </div>
    );
  if (account && (pending || !context)) return <RouteSkeleton kind="daily" />;
  return (
    <TodayView
      key={context ? `${context.profileId}:${context.version}` : 'local'}
      signedIn={account}
      profileId={context?.profileId}
      birth={context?.birth}
      seedIdentity={context?.seedIdentity}
      knowledge={context?.knowledge}
      tz={context?.tz}
      plan={context?.plan ?? 'free'}
      vedicUsed={context?.vedicUsed ?? false}
      panchangDefaultOpen={context?.panchangDefaultOpen}
    />
  );
}
