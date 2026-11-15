'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ThemeSwitch } from '@/components/theme-provider';
import { deleteAccountAction, updateSettingsAction } from '@/app/me/actions';
import { clearAnonymous, readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { Locale } from '@tianji/shared';
import { SettingsSchema } from '@/lib/account-service-schema';
import { PushReminderSettings } from '@/components/me/push-reminder-settings';
import { SettingsData } from '@/components/me/settings-data';
import { TimeZoneField } from '@/components/me/time-zone-field';
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
  pushAvailable = false,
  version,
  logout,
}: {
  initial: Settings | null;
  signedIn: boolean;
  pushAvailable?: boolean;
  /** Real build version; the row is hidden when none is known. */
  version?: string | null;
  /** Server-rendered sign-out control, present only for a signed-in owner. */
  logout?: ReactNode;
}) {
  const { pending, run } = useSubmitTransition();
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
    [working, setBusy] = useState(false),
    [status, setStatus] = useState<'saved' | 'error' | null>(null),
    [removeError, setRemoveError] = useState(false);
  const busy = working || pending;
  // Chinese screens ask for 「删除」; the English token stays valid everywhere, and the server accepts only these exact words.
  const confirmed = confirm === t('me.deleteWord') || confirm === 'DELETE';
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
    setRemoveError(false);
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
      setRemoveError(true);
      setBusy(false);
    }
  }
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('me.settings')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(save);
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
            <option value="zh-TW">{t('nav.locale.zh-TW')}</option>
            <option value="en">{t('me.language.en')}</option>
          </select>
        </label>
        <div className="settings-theme">
          <span aria-hidden>{t('nav.theme')}</span>
          <ThemeSwitch />
        </div>
        <label>
          {t('me.name')}
          <input
            maxLength={80}
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        {/* DESIGN-GAP: Sound effects are not implemented, so the switch is hidden; soundOn is still saved unchanged. */}
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
        <TimeZoneField value={form.tz} onChange={(tz) => setForm((f) => ({ ...f, tz }))} />
        <div className="settings-save">
          <Button disabled={busy} type="submit">
            {t(busy ? 'common.loading' : 'me.save')}
          </Button>
          {status ? (
            <p role={status === 'error' ? 'alert' : 'status'}>
              {t(status === 'saved' ? 'me.saved' : 'report.error.E_INTERNAL')}
            </p>
          ) : null}
        </div>
      </form>
      {pushAvailable ? <PushReminderSettings signedIn={signedIn} /> : null}
      <SettingsData signedIn={signedIn} version={version} />
      {logout ? (
        <section className="report-card">
          <h2>{t('me.account')}</h2>
          {logout}
        </section>
      ) : null}
      <section className="report-card danger-zone">
        <h2>{t('me.danger')}</h2>
        <p>{t(signedIn ? 'me.deleteHelp' : 'me.deleteLocalHelp')}</p>
        {/* An anonymous visitor has no account to delete, only device data to clear. */}
        <Button onClick={() => setOpen(true)}>
          {t(signedIn ? 'me.delete' : 'me.deleteLocal')}
        </Button>
      </section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t(signedIn ? 'me.delete' : 'me.deleteLocal')}
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
        <Button disabled={busy || !confirmed} action={remove}>
          {t(signedIn ? 'me.deleteFinal' : 'me.deleteLocal')}
        </Button>
        {removeError ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
      </Dialog>
    </section>
  );
}
