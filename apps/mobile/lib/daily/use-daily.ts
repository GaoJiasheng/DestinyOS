import { useEffect, useState } from 'react';
import { useProfiles } from '../profiles';
import { usePreferences } from '../preferences';
import { dailyDate, loadDaily, type NativeDaily } from './service';
/** Cancel stale day/profile completions and expose deterministic pull-to-refresh without unmounting content. */
export function useDaily(requested?: string) {
  const { active, settings } = useProfiles();
  const locale = usePreferences((s) => s.locale);
  const tz = settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [date, setDate] = useState(() => dailyDate(requested, tz));
  // Keyed by profile and day: a refresh or locale change keeps the old result (and the journal
  // editor below it) mounted, while a different day or profile never shows stale numbers.
  const key = `${active?.id ?? ''}|${date}`;
  const [loaded, setLoaded] = useState<{ key: string; daily: NativeDaily } | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setDate(dailyDate(requested, tz));
  }, [requested, tz]);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(false);
    // DESIGN-GAP: Yield one frame before synchronous offline computation so loading/refresh can paint.
    const timer = setTimeout(() => {
      void loadDaily(active, date, tz, locale)
        .then((next) => {
          if (alive) setLoaded({ key, daily: next });
        })
        .catch(() => {
          if (alive) setError(true);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 32);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active, date, tz, locale, retry, key]);
  const value = loaded?.key === key ? loaded.daily : null;
  return { active, tz, date, setDate, value, busy, error, refresh: () => setRetry((n) => n + 1) };
}
