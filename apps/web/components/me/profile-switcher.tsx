'use client';
import { useEffect, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Link, useRouter } from '@/i18n/navigation';
import { listProfilesAction, selectProfileAction } from '@/app/profiles/actions';
import { Dialog } from '@/components/ui/dialog';
import { UserRound } from 'lucide-react';
type ProfileList = Extract<Awaited<ReturnType<typeof listProfilesAction>>, { ok: true }>['data'];
/** Avatar menu fetches only owner metadata when opened and refreshes active RSC pages on selection. */
export function ProfileSwitcher() {
  const t = useCopy(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [data, setData] = useState<ProfileList | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void listProfilesAction()
      .then((r) => {
        if (active) {
          if (r.ok) {
            setData(r.data);
            setError(false);
          } else setError(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={t('profiles.switch')}
        onClick={() => setOpen(true)}
      >
        <UserRound size={21} aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t('profiles.switch')}>
        {error ? (
          <p role="alert">{t('report.error.E_INTERNAL')}</p>
        ) : !data ? (
          <p role="status">{t('report.loading')}</p>
        ) : data.items.length ? (
          <div className="settings-fields">
            {data.items.map((p) => (
              <button
                type="button"
                key={p.id}
                disabled={busy}
                aria-pressed={p.id === data.selectedId}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await selectProfileAction(p.id);
                    if (r.ok) {
                      setOpen(false);
                      router.refresh();
                      window.dispatchEvent(new Event('tianji:profile-changed'));
                    } else setError(true);
                  } catch {
                    setError(true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('report.content', { text: p.label || t('profiles.unnamed') })}
                {p.isDefault ? ` · ${t('profiles.default')}` : ''}
              </button>
            ))}
          </div>
        ) : (
          <p>{t('profiles.empty')}</p>
        )}
        <div className="dialog-actions">
          <Link href="/me/profiles" onClick={() => setOpen(false)}>
            {t('profiles.manage')}
          </Link>
          <Link href="/me" onClick={() => setOpen(false)}>
            {t('nav.me')}
          </Link>
          <Link href="/synastry" onClick={() => setOpen(false)}>
            {t('nav.synastry')}
          </Link>
        </div>
      </Dialog>
    </>
  );
}
