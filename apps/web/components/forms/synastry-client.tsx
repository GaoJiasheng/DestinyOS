'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSignedIn } from '@/components/providers';
import { listProfilesAction } from '@/app/profiles/actions';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { useCopy } from '@/i18n/use-copy';
const SynastryForm = dynamic(
  () => import('./synastry-form').then((module) => module.SynastryForm),
  { ssr: false, loading: () => <RouteSkeleton kind="form" /> },
);
/** Owner inputs remain outside public HTML and Flight, including authenticated asset requests. */
export function SynastryClient() {
  const signedIn = useSignedIn();
  const t = useCopy();
  const [result, setResult] = useState<Awaited<ReturnType<typeof listProfilesAction>> | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => {
      setResult(null);
      setRevision((value) => value + 1);
    };
    window.addEventListener('tianji:profile-changed', changed);
    return () => window.removeEventListener('tianji:profile-changed', changed);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void listProfilesAction()
      .then((value) => {
        if (live) setResult(value);
      })
      .catch(() => {
        if (live) setResult({ ok: false, error: { code: 'E_INTERNAL' } });
      });
    return () => {
      live = false;
    };
  }, [signedIn, revision]);
  // DESIGN-GAP: Owner metadata hydrates in a client island; the existing server action still authenticates and scopes every profile.
  if (signedIn && !result) return <RouteSkeleton kind="form" />;
  if (result && !result.ok) return <p role="alert">{t('report.error.E_INTERNAL')}</p>;
  return (
    <SynastryForm
      key={result?.ok ? (result.data.selectedId ?? 'empty') : 'anonymous'}
      signedIn={signedIn}
      profiles={result?.ok ? result.data.items : undefined}
      selectedId={result?.ok ? result.data.selectedId : undefined}
    />
  );
}
