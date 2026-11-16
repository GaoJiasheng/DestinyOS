'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import {
  readAnonymous,
  clearAnonymous,
  updateAnonymous,
  type AnonymousData,
} from '@/lib/anonymous-storage';
import { importAnonymousDataAction } from '@/app/readings/actions';
import { importInBatches, profileStored, type ImportSummary } from '@/lib/import-batches';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { notifySuccess } from '@/lib/notify';
import type { MessageKey } from '@/i18n/catalog';
const DISMISS_KEY = 'tianji:anon-import-later';
function dismissedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
function dismissForSession() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Blocked storage only means the offer may appear again on the next page.
  }
}
const profileKey: Record<ImportSummary['profile'], MessageKey | null> = {
  none: null,
  created: 'report.importFlow.profileCreated',
  savedOther: 'report.importFlow.profileSavedOther',
  duplicate: 'report.importFlow.profileDuplicate',
  skipped: 'report.importFlow.profileSkipped',
  limit: 'report.importFlow.profileLimit',
  failed: 'report.importFlow.profileFailed',
};
/** Remove only what the account acknowledged; everything else stays on the device for a later retry. */
async function keepRemaining(data: AnonymousData, summary: ImportSummary) {
  const done = new Set(summary.doneIds);
  const keepProfile = Boolean(data.profile) && !profileStored(summary.profile);
  if (data.readings.every((r) => done.has(r.id)) && !keepProfile) {
    clearAnonymous();
    return;
  }
  await updateAnonymous((current) => ({
    ...current,
    readings: current.readings.filter((r) => !done.has(r.id)),
    ...(keepProfile ? {} : { profile: undefined, displayName: undefined }),
  }));
}
/** Batch import with progress and a per-item summary; reusable from the history and "me" banners. */
export function ImportDialog({
  data,
  open,
  onOpenChange,
  onFinished,
}: {
  data: AnonymousData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}) {
  const t = useCopy();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProfile, setSaveProfile] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  async function start() {
    if (!data) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const outcome = await importInBatches(
        data,
        saveProfile,
        (payload) => importAnonymousDataAction(payload),
        (done, total) => setProgress({ done, total }),
      );
      if ('error' in outcome) {
        setError(`report.error.${outcome.error}`);
        return;
      }
      await keepRemaining(data, outcome).catch(() => setError('report.storageError'));
      dismissForSession();
      onFinished?.();
      const clean = !outcome.failed && !['skipped', 'limit', 'failed'].includes(outcome.profile);
      if (clean) {
        onOpenChange(false);
        notifySuccess(t('report.import.done'));
        router.push('/me/history');
        router.refresh();
      } else setSummary(outcome);
    } catch {
      setError('report.error.E_INTERNAL');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  const profileLine = summary ? profileKey[summary.profile] : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing without importing counts as "later" for the rest of this session.
        if (!next) dismissForSession();
        onOpenChange(next);
      }}
      title={t('report.import.title')}
      description={t('report.import.body', { count: data?.readings.length ?? 0 })}
    >
      {summary ? (
        <div role="status">
          <p>{t('report.importFlow.result', { imported: summary.imported })}</p>
          {summary.failed ? (
            <p>{t('report.importFlow.failed', { failed: summary.failed })}</p>
          ) : null}
          {profileLine ? <p>{t(profileLine)}</p> : null}
          <div className="hero-actions">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('report.importFlow.close')}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push('/me/history');
                router.refresh();
              }}
            >
              {t('report.importFlow.viewHistory')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {data?.profile ? (
            <label className="import-profile-option">
              <input
                type="checkbox"
                checked={saveProfile}
                disabled={busy}
                onChange={(e) => setSaveProfile(e.target.checked)}
              />
              <span>
                {t('report.importFlow.saveProfile')}
                <small className="muted">{t('report.importFlow.saveProfileHint')}</small>
              </span>
            </label>
          ) : null}
          {busy && progress ? (
            <p role="status" aria-live="polite">
              {t('report.importFlow.progress', progress)}
            </p>
          ) : null}
          {error ? <p role="alert">{t(error as MessageKey)}</p> : null}
          <div className="hero-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                dismissForSession();
                onOpenChange(false);
              }}
            >
              {t('report.import.later')}
            </Button>
            <Button disabled={busy || !data} aria-busy={busy} action={start}>
              {t(busy ? 'common.loading' : 'report.import.confirm')}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
/** Offer import after session confirmation; failures retain the encrypted device copy for a safe retry. */
export function AnonymousImport() {
  const pathname = usePathname();
  const [data, setData] = useState<AnonymousData | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    if (!document.cookie.includes('anon_import=1') || dismissedThisSession()) return;
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
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname]);
  return <ImportDialog data={data} open={open} onOpenChange={setOpen} />;
}
