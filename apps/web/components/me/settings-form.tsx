'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ThemeSwitch } from '@/components/theme-provider';
import { deleteAccountAction, updateSettingsAction } from '@/app/me/actions';
import { clearAnonymous, readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { Locale } from '@tianji/shared';
import { SettingsSchema } from '@/lib/account-service-schema';
import webPackage from '../../package.json';
type Settings = {
  locale: Locale;
  theme: string | null;
  soundOn: boolean;
  reducedMotion: boolean;
  tz: string | null;
  name: string | null;
};
/** Persist account/device preferences and provide explicit export and destructive confirmation flows. */
export function SettingsForm({
  initial,
  signedIn,
}: {
  initial: Settings | null;
  signedIn: boolean;
}) {
  const t = useCopy(),
    locale = useLocale() as Locale;
  const [form, setForm] = useState(
      initial ?? {
        locale,
        theme: 'auto',
        soundOn: false,
        reducedMotion: false,
        tz: null,
        name: '',
      },
    ),
    [panchang, setPanchang] = useState(false),
    [confirm, setConfirm] = useState(''),
    [feedback, setFeedback] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<'saved' | 'error' | null>(null);
  useEffect(() => {
    setPanchang(localStorage.getItem('tianji-panchang') === 'true');
    if (!signedIn)
      void readAnonymous()
        .then((data) => {
          const settings = data?.settings ?? {};
          const parsed = SettingsSchema.safeParse(
            Object.fromEntries(
              ['locale', 'theme', 'soundOn', 'reducedMotion', 'tz', 'name']
                .filter((key) => key in settings)
                .map((key) => [key, settings[key]]),
            ),
          );
          if (parsed.success) setForm((f) => ({ ...f, ...parsed.data }));
        })
        .catch(() => setStatus('error'));
  }, [signedIn]);
  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const theme = localStorage.getItem('tianji-theme') ?? 'auto',
        data = SettingsSchema.parse({ ...form, theme });
      if (signedIn) {
        const r = await updateSettingsAction(data);
        if (!r.ok) throw new Error(r.error.code);
      } else await updateAnonymous((d) => ({ ...d, settings: { ...d.settings, ...data } }));
      localStorage.setItem('tianji-sound', String(data.soundOn));
      localStorage.setItem('tianji-reduced-motion', String(data.reducedMotion));
      localStorage.setItem('tianji-panchang', String(panchang));
      if (data.tz) localStorage.setItem('tianji-tz', data.tz);
      else localStorage.removeItem('tianji-tz');
      document.documentElement.dataset.reducedMotion = String(data.reducedMotion);
      window.dispatchEvent(new Event('tianji-settings'));
      document.cookie = `NEXT_LOCALE=${form.locale}; Path=/; SameSite=Lax`;
      setStatus('saved');
      if (form.locale !== locale) window.location.assign(`/${form.locale}/me/settings`);
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      if (signedIn) {
        const r = await deleteAccountAction(confirm, feedback);
        if (!r.ok) throw new Error(r.error.code);
      }
      clearAnonymous();
      for (const k of [
        'tianji-theme',
        'tianji-sound',
        'tianji-reduced-motion',
        'tianji-panchang',
        'tianji-tz',
      ])
        localStorage.removeItem(k);
      window.location.assign(`/${locale}/auth/login?deleted=1`);
    } catch {
      setStatus('error');
      setBusy(false);
    }
  }
  async function download() {
    setStatus(null);
    try {
      const blob = signedIn
        ? await fetch('/api/v1/me/export').then(async (r) => {
            if (!r.ok) throw new Error('Export failed');
            return r.blob();
          })
        : new Blob([JSON.stringify({ ok: true, data: await readAnonymous() }, null, 2)], {
            type: 'application/json',
          });
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = 'tianji-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus('error');
    }
  }
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('me.settings')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="report-card settings-fields"
      >
        <label>
          {t('me.language')}
          <select
            aria-label={t('me.language')}
            value={form.locale}
            onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })}
          >
            <option value="zh">{t('me.language.zh')}</option>
            <option value="en">{t('me.language.en')}</option>
          </select>
        </label>
        <ThemeSwitch />
        <label>
          {t('me.name')}
          <input
            maxLength={80}
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.soundOn}
            onChange={(e) => setForm({ ...form, soundOn: e.target.checked })}
          />
          {t('me.sound')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.reducedMotion}
            onChange={(e) => setForm({ ...form, reducedMotion: e.target.checked })}
          />
          {t('me.motion')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={panchang}
            onChange={(e) => setPanchang(e.target.checked)}
          />
          {t('me.panchang')}
        </label>
        <label>
          {t('me.tz')}
          <input
            list="time-zones"
            value={form.tz ?? ''}
            placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone}
            onChange={(e) => setForm({ ...form, tz: e.target.value || null })}
          />
          <datalist id="time-zones">
            {Intl.supportedValuesOf('timeZone').map((zone) => (
              <option value={zone} key={zone} />
            ))}
          </datalist>
        </label>
        <p>{t('me.tzHelp')}</p>
        <Button disabled={busy} type="submit">
          {t('me.save')}
        </Button>
      </form>
      <section className="report-card">
        <h2>{t('me.data')}</h2>
        <Button onClick={() => void download()}>{t('me.export')}</Button>
        <p>
          <Link href="/privacy">{t('me.privacy')}</Link>
        </p>
        <p>{t('me.version', { version: webPackage.version })}</p>
      </section>
      <section className="report-card danger-zone">
        <h2>{t('me.danger')}</h2>
        <p>{t(signedIn ? 'me.deleteHelp' : 'me.deleteLocalHelp')}</p>
        <Button onClick={() => setOpen(true)}>{t('me.delete')}</Button>
      </section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('me.delete')}
        description={t('me.deleteConfirmHelp')}
      >
        <label>
          {t('me.deleteConfirm')}
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </label>
        {signedIn ? (
          <label>
            <input
              type="checkbox"
              checked={feedback}
              onChange={(e) => setFeedback(e.target.checked)}
            />
            {t('me.deleteFeedback')}
          </label>
        ) : null}
        <Button disabled={busy || confirm !== 'DELETE'} onClick={() => void remove()}>
          {t('me.deleteFinal')}
        </Button>
        {status === 'error' ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
      </Dialog>
      {status ? (
        <p role={status === 'error' ? 'alert' : 'status'}>
          {t(status === 'saved' ? 'me.saved' : 'report.error.E_INTERNAL')}
        </p>
      ) : null}
    </section>
  );
}
