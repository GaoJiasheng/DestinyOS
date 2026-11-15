'use client';
import { useEffect, useState } from 'react';
import { DailyChartSchema, type BirthInput, type Locale } from '@tianji/shared';
import { ReportSchema } from '@/lib/reading-schema';
import { dailyExample, dailyExamplePath } from '@/lib/daily-example';
import type { KnowledgeBundle } from '@tianji/content';
import type { DailyReport } from '@/lib/daily-compute';
import {
  getDailyAction,
  recordAnonymousDailyViewAction,
  recordOwnerDailyViewAction,
} from '@/app/today/actions';
import { readAnonymous } from '@/lib/anonymous-storage';
import { localToday } from '@/lib/daily-date';
import { calculateDailyInWorker } from '@/lib/daily-worker';
export type DailyLoadError = 'timeout' | 'internal';
/** Load owner or device daily reports; cancel worker results when date/profile inputs change.
 * @param options Selected civil date (validated `?date=`, or null for today), IANA timezone and presentation preferences.
 */
export function useDailyReport({
  signedIn,
  profileId,
  birth,
  seedIdentity,
  knowledge,
  tz,
  locale,
  requestedDate,
  vedicUsed,
  panchangDefaultOpen,
}: {
  signedIn: boolean;
  profileId?: string;
  birth?: BirthInput;
  seedIdentity?: string;
  knowledge?: KnowledgeBundle;
  tz?: string | null;
  locale: Locale;
  requestedDate: string | null;
  vedicUsed: boolean;
  panchangDefaultOpen: boolean;
}) {
  // DESIGN-GAP: Panchang expansion is a device preference because the documented User schema has no field for it.
  const [zone, setZone] = useState<string | null>(tz ?? null),
    [value, setValue] = useState<DailyReport | null>(null),
    [example, setExample] = useState(false),
    [error, setError] = useState<DailyLoadError | null>(null),
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
    setError(null);
    setFlipped(false);
    setVote(null);
    void (async () => {
      const date = requestedDate ?? localToday(zone);
      if (signedIn && !birth) {
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
          new TextEncoder().encode(`${birth ? seedIdentity : (data?.anonId ?? 'example')}|${date}`),
        );
        const seed = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(
          '',
        );
        return {
          profile: birth ?? data?.profile ?? dailyExample,
          date,
          tz: zone,
          seed,
          locale,
          knowledge,
        };
      });
      const data = await device;
      let computed: DailyReport | null = null;
      if (!birth && !data?.profile && process.env.NEXT_PUBLIC_STATIC_ASSETS === 'true') {
        // DESIGN-GAP: Public date+locale+zone snapshots avoid loading the daily worker for example-only visitors; validate assets and retain offline/client fallback.
        try {
          const response = await fetch(dailyExamplePath(locale, zone, date), {
            signal: controller.signal,
          });
          if (response.ok) {
            const value: unknown = await response.json();
            if (value && typeof value === 'object' && 'chart' in value && 'report' in value) {
              const chart = DailyChartSchema.parse(value.chart);
              const report = ReportSchema.parse(value.report);
              if (chart.date.local === date && chart.date.tz === zone && report.locale === locale)
                computed = { chart, report };
            }
          }
        } catch {
          /* Missing/stale/unsupported snapshots keep the original deterministic calculation. */
        }
      }
      if (!computed) computed = await calculateDailyInWorker(input, controller.signal, locale);
      if (active) {
        setValue(computed);
        setExample(!birth && !data?.profile);
        window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'daily.view' } }));
        if (
          localStorage.getItem('tianji-panchang') === null &&
          data?.readings.some((r) => r.system === 'vedic')
        )
          setPanchang(true);
      }
    })()
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error && reason.message === 'E_TIMEOUT' ? 'timeout' : 'internal',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [signedIn, profileId, birth, seedIdentity, knowledge, zone, locale, retry, requestedDate]);
  useEffect(() => {
    if (!value || (signedIn && !birth)) return;
    // DESIGN-GAP: Record anonymous visit dimensions after the first result paint; telemetry's RSC response must not delay the locally computed content.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void (
          signedIn ? recordOwnerDailyViewAction(locale) : recordAnonymousDailyViewAction(locale)
        ).catch(() => undefined);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [signedIn, birth, value, locale]);
  return {
    zone,
    value,
    example,
    error,
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
