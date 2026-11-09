'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@tianji/shared';
import type { DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';
import { getDailyRangeAction, getCalendarYearAction } from '@/app/today/actions';
import { readAnonymous } from '@/lib/anonymous-storage';
import { calculateCalendarInWorker } from '@/lib/calendar-worker';
import { monthBounds, weekBounds, type PeriodKind } from '@/lib/daily-period';

export type DailyRangeResult = { days: DailyRangeDay[]; events: CalendarEvent[] };
export type DailyRangeState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'guide' }
  | { status: 'ready'; result: DailyRangeResult; from: string; to: string };

// DESIGN-GAP: Results are keyed by profile identity and date range for the page session only; scores are recomputed after a reload and birth data never leaves the worker.
const cache = new Map<string, DailyRangeResult>();

/** Lazily compute a week or month of scores: signed-in owners use the range Actions, device profiles use the calendar worker. */
export function useDailyRange({
  kind,
  date,
  tz,
  signedIn,
  profileId,
  locale,
}: {
  kind: PeriodKind;
  date: string;
  tz: string;
  signedIn: boolean;
  profileId?: string;
  locale: Locale;
}): DailyRangeState {
  const { from, to } = kind === 'week' ? weekBounds(date) : monthBounds(date);
  const [state, setState] = useState<DailyRangeState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const key = (owner: string) => `${owner}|${from}|${to}|${tz}|${locale}|${kind}`;
    setState({ status: 'loading' });
    void (async () => {
      let result: DailyRangeResult;
      if (signedIn) {
        const cached = cache.get(key(`owner:${profileId ?? ''}`));
        if (cached) return setState({ status: 'ready', result: cached, from, to });
        const [range, year] = await Promise.all([
          getDailyRangeAction({ from, to, tz, locale }),
          kind === 'month'
            ? getCalendarYearAction({ year: Number(from.slice(0, 4)), tz, locale })
            : Promise.resolve(null),
        ]);
        if (!range.ok) {
          if (range.error.code === 'E_PROFILE_REQUIRED') {
            if (active) setState({ status: 'guide' });
            return;
          }
          throw new Error(range.error.code);
        }
        result = { days: range.data, events: year?.ok ? year.data : [] };
        cache.set(key(`owner:${profileId ?? ''}`), result);
      } else {
        const device = await readAnonymous();
        if (!device?.profile) {
          if (active) setState({ status: 'guide' });
          return;
        }
        const owner = `device:${device.anonId}`;
        const cached = cache.get(key(owner));
        if (cached) return setState({ status: 'ready', result: cached, from, to });
        const computed = await calculateCalendarInWorker(
          kind === 'week'
            ? { profile: device.profile, from, to, tz, identity: device.anonId, locale }
            : {
                profile: device.profile,
                month: from.slice(0, 7),
                tz,
                identity: device.anonId,
                locale,
              },
          controller.signal,
        );
        result = { days: computed.days, events: computed.events };
        cache.set(key(owner), result);
      }
      if (active) setState({ status: 'ready', result, from, to });
    })().catch(() => {
      if (active) setState({ status: 'error', retry: () => setAttempt((n) => n + 1) });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, from, to, tz, signedIn, profileId, locale, attempt]);
  return state;
}
