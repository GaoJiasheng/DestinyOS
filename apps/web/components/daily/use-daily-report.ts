'use client';
import { useEffect, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { BirthInput, Locale } from '@tianji/shared';
import type { DailyReport } from '@/lib/daily-compute';
import { getDailyAction, recordAnonymousDailyViewAction } from '@/app/today/actions';
import { readAnonymous } from '@/lib/anonymous-storage';
import { localToday } from '@/lib/daily-date';
import { calculateDailyInWorker } from '@/lib/daily-worker';
const demo: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Example', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};
/** Load owner or device daily reports; cancel worker results when date/profile inputs change.
 * @param options Selected civil date, IANA timezone and presentation preferences.
 */
export function useDailyReport({
  signedIn,
  profileId,
  tz,
  locale,
  requestedDate,
  vedicUsed,
  panchangDefaultOpen,
}: {
  signedIn: boolean;
  profileId?: string;
  tz?: string | null;
  locale: Locale;
  requestedDate: string | null;
  vedicUsed: boolean;
  panchangDefaultOpen: boolean;
}) {
  // DESIGN-GAP: Panchang expansion is a device preference because the documented User schema has no field for it.
  const [offset, setOffset] = useState(0),
    [zone, setZone] = useState<string | null>(tz ?? null),
    [value, setValue] = useState<DailyReport | null>(null),
    [example, setExample] = useState(false),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0),
    [panchang, setPanchang] = useState(vedicUsed || panchangDefaultOpen),
    [flipped, setFlipped] = useState(false),
    [vote, setVote] = useState<number | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem('tianji-tz');
    setZone(tz ?? saved ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    const pref = localStorage.getItem('tianji-panchang');
    if (pref !== null) setPanchang(pref === 'true');
  }, [tz]);
  useEffect(() => {
    if (!zone) return;
    document.cookie = `tz=${encodeURIComponent(zone)}; Path=/; SameSite=Lax`;
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setError(false);
    setFlipped(false);
    setVote(null);
    void (async () => {
      const date = Temporal.PlainDate.from(requestedDate ?? localToday(zone))
        .add({ days: offset })
        .toString();
      if (signedIn) {
        const result = await getDailyAction({ date, tz: zone, locale, profileId });
        if (result.ok) {
          if (active) {
            setValue(result.data);
            setExample(false);
          }
          window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'daily.view' } }));
          return;
        }
        if (result.error.code !== 'E_PROFILE_REQUIRED') throw new Error(result.error.code);
      }
      const device = signedIn ? Promise.resolve(null) : readAnonymous();
      const input = device.then(async (data) => {
        const hash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${data?.anonId ?? 'example'}|${date}`),
        );
        const seed = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(
          '',
        );
        return { profile: data?.profile ?? demo, date, tz: zone, seed, locale };
      });
      const computed = await calculateDailyInWorker(input, controller.signal, locale);
      const data = await device;
      if (active) {
        setValue(computed);
        setExample(!data?.profile);
        window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'daily.view' } }));
        if (
          localStorage.getItem('tianji-panchang') === null &&
          data?.readings.some((r) => r.system === 'vedic')
        )
          setPanchang(true);
      }
    })()
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [signedIn, profileId, zone, offset, locale, retry, requestedDate]);
  useEffect(() => {
    if (signedIn || !value) return;
    // DESIGN-GAP: Record anonymous visit dimensions after the first result paint; telemetry's RSC response must not delay the locally computed content.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void recordAnonymousDailyViewAction(locale).catch(() => undefined);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [signedIn, value, locale]);
  return {
    offset,
    setOffset,
    zone,
    value,
    example,
    error,
    setError,
    busy,
    setRetry,
    panchang,
    setPanchang,
    flipped,
    setFlipped,
    vote,
    setVote,
  };
}
