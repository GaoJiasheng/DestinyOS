'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import type { BirthInput, Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { useRouter } from '@/i18n/navigation';
import { BirthForm } from '@/components/forms/birth-form';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  listProfilesAction,
  saveProfileAction,
  defaultProfileAction,
  removeProfileAction,
  selectProfileAction,
  profileDetailAction,
} from '@/app/profiles/actions';
type Data = Extract<Awaited<ReturnType<typeof listProfilesAction>>, { ok: true }>['data'];
type Relation = Data['items'][number]['relation'];
/** Add/edit/delete/default controls share the existing validated birth editor. */
export function ProfileManager({ initial }: { initial: Data }) {
  const t = useCopy(),
    locale = useLocale() as Locale,
    router = useRouter();
  const [data, setData] = useState(initial),
    [edit, setEdit] = useState<{
      id?: string;
      birth?: BirthInput & { displayName?: string };
    } | null>(null),
    [relation, setRelation] = useState<Relation>('self'),
    [deleting, setDeleting] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function reload() {
    const r = await listProfilesAction();
    if (r.ok) setData(r.data);
    router.refresh();
    window.dispatchEvent(new Event('tianji:profile-changed'));
  }
  async function mutate(work: () => ReturnType<typeof defaultProfileAction>) {
    setBusy(true);
    setError(null);
    try {
      const r = await work();
      if (!r.ok) setError(r.error.code);
      else await reload();
    } catch {
      setError('E_INTERNAL');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('profiles.manage')}</h1>
      <p>{t('profiles.quota', { count: data.items.length, limit: data.limit })}</p>
      {error ? <p role="alert">{t(`report.error.${error}` as Parameters<typeof t>[0])}</p> : null}
      {data.items.length ? (
        <ul className="settings-fields">
          {data.items.map((p) => (
            <li className="report-card" key={p.id}>
              <h2>{t('report.content', { text: p.label || t('profiles.unnamed') })}</h2>
              <p>
                {t(`profiles.relation.${p.relation}`)}
                {p.isDefault ? ` · ${t('profiles.default')}` : ''}
                {p.id === data.selectedId ? ` · ${t('profiles.selected')}` : ''}
              </p>
              <div className="hero-actions">
                <Button
                  disabled={busy || p.id === data.selectedId}
                  onClick={() =>
                    void mutate(() =>
                      selectProfileAction(p.id).then((r) =>
                        r.ok ? { ok: true as const, data: { saved: true } } : r,
                      ),
                    )
                  }
                >
                  {t('profiles.select')}
                </Button>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const r = await profileDetailAction(p.id);
                      if (r.ok) {
                        setEdit({ id: p.id, birth: r.data });
                        setRelation(p.relation);
                      } else setError(r.error.code);
                    } catch {
                      setError('E_INTERNAL');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('profiles.edit')}
                </Button>
                <Button
                  disabled={busy || p.isDefault}
                  variant="ghost"
                  onClick={() => void mutate(() => defaultProfileAction(p.id))}
                >
                  {t('profiles.setDefault')}
                </Button>
                <Button disabled={busy} variant="ghost" onClick={() => setDeleting(p.id)}>
                  {t('profiles.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('profiles.empty')}</p>
      )}
      <Button
        disabled={busy || data.items.length >= data.limit}
        onClick={() => {
          setEdit({});
          setRelation('other');
          setError(null);
        }}
      >
        {t('profiles.add')}
      </Button>
      {edit ? (
        <div className="report-card">
          <label className="birth-field">
            {t('profiles.relation')}
            <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
              {(['self', 'partner', 'family', 'friend', 'other'] as const).map((r) => (
                <option key={r} value={r}>
                  {t(`profiles.relation.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <BirthForm
            key={edit.id ?? 'new'}
            signedIn
            profileMode
            initial={edit.birth}
            completionKey="profiles.save"
            onComplete={async (birth, label) => {
              setBusy(true);
              setError(null);
              try {
                const r = await saveProfileAction({
                  id: edit.id,
                  birth,
                  metadata: { label, relation },
                  locale,
                });
                if (r.ok) {
                  setEdit(null);
                  await reload();
                } else setError(r.error.code);
              } catch {
                setError('E_INTERNAL');
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button variant="ghost" disabled={busy} onClick={() => setEdit(null)}>
            {t('profiles.cancel')}
          </Button>
        </div>
      ) : null}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
        title={t('profiles.delete')}
        description={t('profiles.deleteConfirm')}
      >
        <Button
          disabled={busy}
          onClick={() =>
            void mutate(async () => {
              const r = await removeProfileAction(deleting);
              if (r.ok) setDeleting(null);
              return r.ok ? { ok: true as const, data: { saved: true } } : r;
            })
          }
        >
          {t('profiles.delete')}
        </Button>
      </Dialog>
    </section>
  );
}
