'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { readAnonymous, clearAnonymous, type AnonymousData } from '@/lib/anonymous-storage';
import { importAnonymousDataAction } from '@/app/readings/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { MessageKey } from '@/i18n/catalog';
/** Offer import after session confirmation; failures retain the encrypted device copy for a safe retry. */
export function AnonymousImport() {
  const t = useCopy();
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<AnonymousData | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!document.cookie.includes('anon_import=1')) return;
    void Promise.all([
      fetch('/api/auth/session').then((r) => r.json() as Promise<unknown>),
      readAnonymous(),
    ])
      .then(([session, stored]) => {
        if (
          active &&
          session &&
          typeof session === 'object' &&
          'user' in session &&
          stored &&
          (stored.readings.length || stored.profile)
        ) {
          setData(stored);
          setOpen(true);
        }
      })
      .catch(() => {
        if (active) setError('report.storageError');
      });
    return () => {
      active = false;
    };
  }, [pathname]);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('report.import.title')}
      description={t('report.import.body', { count: data?.readings.length ?? 0 })}
    >
      {error ? <p role="alert">{t(error as MessageKey)}</p> : null}
      <div className="hero-actions">
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          {t('report.import.later')}
        </Button>
        <Button
          disabled={busy || !data}
          action={async () => {
            if (!data) return;
            setBusy(true);
            setError(null);
            await importAnonymousDataAction({
              ...data,
              readings: data.readings.map(({ id, request, chart, meta, createdAt }) => ({
                id,
                request,
                chart,
                meta,
                createdAt,
              })),
            })
              .then((result) => {
                if (!result.ok) {
                  setError(`report.error.${result.error.code}`);
                  return;
                }
                clearAnonymous();
                setOpen(false);
                toast.success(t('report.import.done'));
                router.push('/me/history');
                router.refresh();
              })
              .catch(() => setError('report.error.E_INTERNAL'))
              .finally(() => setBusy(false));
          }}
        >
          {t(busy ? 'common.loading' : 'report.import.confirm')}
        </Button>
      </div>
    </Dialog>
  );
}
