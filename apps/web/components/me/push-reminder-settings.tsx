'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { LoginLink } from '@/components/auth/login-link';
import {
  pushStatusAction,
  subscribePushAction,
  unsubscribePushAction,
} from '@/app/me/push-actions';
import { base64UrlDecode, base64UrlEncode } from '@/lib/web-push';
import { DEFAULT_REMINDER_HOUR, REMINDER_HOURS } from '@/lib/web-push-schedule';

type Availability = 'checking' | 'ready' | 'unsupported' | 'ios-install' | 'denied';
type Notice = 'dismissed' | 'error' | null;
const WORKER_READY_MS = 10_000;
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Environment check only: reads the permission state and never requests it. */
function detect(): Availability {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !standalone) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'ready';
}

/** Install the site worker on demand; `ready` never settles without an active worker, so it is raced. */
async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  if (!(await navigator.serviceWorker.getRegistration('/')))
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('Service worker not ready')), WORKER_READY_MS),
    ),
  ]);
}

/** Reuse the browser's subscription unless it was created for a different VAPID key. */
async function browserSubscription(registration: ServiceWorkerRegistration) {
  const existing = await registration.pushManager.getSubscription();
  const key = existing?.options.applicationServerKey;
  if (existing && key && base64UrlEncode(key) === publicKey) return existing;
  if (existing) await existing.unsubscribe();
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlDecode(publicKey),
  });
}

function keyOf(subscription: PushSubscription, name: PushEncryptionKeyName): string {
  const key = subscription.getKey(name);
  if (!key) throw new Error('Push subscription key missing');
  return base64UrlEncode(key);
}

/** Daily fortune reminder for this browser; permission is requested only by the switch itself. */
export function PushReminderSettings({ signedIn }: { signedIn: boolean }) {
  const t = useCopy();
  const locale = useLocale();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState<number>(DEFAULT_REMINDER_HOUR);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const current = detect();
    setAvailability(current);
    if (current !== 'ready' || !signedIn) return;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        const result = await pushStatusAction(subscription.endpoint);
        if (live && result.ok && result.data.subscribed) {
          setEnabled(true);
          if (result.data.hour !== null) setHour(result.data.hour);
        }
      } catch {
        /* The switch stays off; the user can still enable it explicitly. */
      }
    })();
    return () => {
      live = false;
    };
  }, [signedIn]);

  async function save(registration: ServiceWorkerRegistration, reminderHour: number) {
    const subscription = await browserSubscription(registration);
    const result = await subscribePushAction({
      endpoint: subscription.endpoint,
      p256dh: keyOf(subscription, 'p256dh'),
      auth: keyOf(subscription, 'auth'),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale,
      hour: reminderHour,
    });
    if (!result.ok) throw new Error(result.error.code);
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } catch {
      setNotice('error');
    } finally {
      setBusy(false);
    }
  }

  function enable() {
    return run(async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setAvailability('denied');
        return;
      }
      if (permission !== 'granted') {
        setNotice('dismissed');
        return;
      }
      await save(await activeRegistration(), hour);
      setEnabled(true);
    });
  }

  function disable() {
    return run(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    });
  }

  function changeHour(next: number) {
    setHour(next);
    if (!enabled) return;
    void run(async () => save(await activeRegistration(), next));
  }

  const blocked =
    availability === 'unsupported'
      ? t('me.push.unsupported')
      : availability === 'ios-install'
        ? t('me.push.iosInstall')
        : availability === 'denied'
          ? t('me.push.denied')
          : null;

  return (
    <section className="report-card settings-fields" aria-labelledby="push-reminder-title">
      <h2 id="push-reminder-title">{t('me.push.title')}</h2>
      <p>{t('me.push.help')}</p>
      {!signedIn ? (
        <p>
          <LoginLink>{t('me.push.signIn')}</LoginLink>
        </p>
      ) : blocked ? (
        <p role="status">{blocked}</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy || availability === 'checking'}
              onChange={() => void (enabled ? disable() : enable())}
            />
            {t('me.push.enable')}
          </label>
          <label>
            {t('me.push.time')}
            <select
              aria-label={t('me.push.time')}
              value={hour}
              disabled={busy}
              onChange={(event) => changeHour(Number(event.target.value))}
            >
              {REMINDER_HOURS.map((entry) => (
                <option value={entry} key={entry}>
                  {`${String(entry).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </label>
          {notice ? (
            <p role={notice === 'error' ? 'alert' : 'status'}>
              {t(notice === 'error' ? 'me.push.error' : 'me.push.dismissed')}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
