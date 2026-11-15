'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { StateArt } from '@/components/art/state-art';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { System } from '@tianji/shared';
import { Link } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { listReadingsAction, deleteReadingAction } from '@/app/readings/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { MessageKey } from '@/i18n/catalog';
type Page = Extract<Awaited<ReturnType<typeof listReadingsAction>>, { ok: true }>['data'];
type Filters = { system: string; search: string; profile: string };
const cleared: Filters = { system: '', search: '', profile: 'all' };
/** Owner history with server-side search/filter, bounded infinite pagination and confirmed swipe deletion. */
export function HistoryList({
  initial,
  profiles = [],
  timeZone,
}: {
  initial: Page;
  profiles?: { id: string; label: string }[];
  /** Account time zone; without one, dates render in the browser's zone after hydration. */
  timeZone?: string;
}) {
  const { pending, run } = useSubmitTransition();
  const t = useCopy(),
    locale = useLocale(),
    [data, setData] = useState(initial),
    [system, setSystem] = useState(''),
    [search, setSearch] = useState(''),
    [profile, setProfile] = useState('all'),
    [working, setBusy] = useState(false),
    [error, setError] = useState(false),
    [remove, setRemove] = useState<string | null>(null),
    // Filters behind the list currently shown, so an empty result can say why and offer a reset.
    [applied, setApplied] = useState<Filters>(cleared);
  const busy = working || pending;
  // Server and hydration agree on UTC; the browser zone takes over after mount when the account has none.
  const [zone, setZone] = useState(timeZone ?? 'UTC');
  useEffect(() => {
    if (!timeZone) setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [timeZone]);
  const sentinel = useRef<HTMLDivElement | null>(null),
    lock = useRef(false),
    generation = useRef(0),
    touch = useRef<{ x: number; y: number } | null>(null);
  const load = useCallback(
    async (append: boolean, filters: Filters = { system, search, profile }) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError(false);
      const current = generation.current;
      try {
        const r = await listReadingsAction({
          limit: 20,
          profile: filters.profile,
          ...(filters.system ? { system: filters.system } : {}),
          ...(filters.search ? { search: filters.search } : {}),
          ...(append && data.nextCursor ? { cursor: data.nextCursor } : {}),
        });
        if (current !== generation.current) return;
        if (r.ok) {
          setData((d) => ({
            items: append ? [...d.items, ...r.data.items] : r.data.items,
            nextCursor: r.data.nextCursor,
          }));
          if (!append) setApplied(filters);
        } else setError(true);
      } catch {
        setError(true);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [system, search, profile, data.nextCursor],
  );
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !data.nextCursor || busy || error) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void load(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [load, busy, error, data.nextCursor]);
  const labelOf = (id: string | null | undefined) => {
    const found = id ? profiles.find((p) => p.id === id) : undefined;
    return found ? found.label || t('report.historyScope.unnamed') : null;
  };
  const scoped = profiles.length > 1;
  return (
    <>
      {scoped ? (
        <p className="muted" role="status" data-testid="history-scope">
          {applied.profile === 'all'
            ? t('report.historyScope.viewingAll')
            : t('report.historyScope.viewing', {
                name: labelOf(applied.profile) ?? t('report.historyScope.unnamed'),
              })}
        </p>
      ) : null}
      <form
        className="history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          generation.current++;
          run(() => load(false));
        }}
      >
        <label>
          {t('me.history.filter')}
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            <option value="">{t('me.history.all')}</option>
            {Object.values(System).map((s) => (
              <option value={s} key={s}>
                {t(`nav.${s === 'daily' ? 'today' : s}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        {scoped ? (
          <label>
            {t('report.historyScope.label')}
            <select value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="all">{t('report.historyScope.all')}</option>
              {profiles.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.label || t('report.historyScope.unnamed')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          {t('report.historyScope.search')}
          <input maxLength={120} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button disabled={busy}>{t(busy ? 'common.loading' : 'me.history.search')}</Button>
      </form>
      {!data.items.length && (applied.system || applied.search || applied.profile !== 'all') ? (
        <div>
          <p>{t('report.history.noMatch')}</p>
          <Button
            variant="secondary"
            disabled={busy}
            action={async () => {
              setSystem('');
              setSearch('');
              setProfile('all');
              generation.current++;
              await load(false, cleared);
            }}
          >
            {t('report.history.clearFilters')}
          </Button>
        </div>
      ) : !data.items.length ? (
        <div>
          <StateArt state="no-report" />
          <p>
            {t('report.history.empty')} <Link href="/bazi/new">{t('form.birth.submit')}</Link>
          </p>
        </div>
      ) : (
        <ul className="history-list">
          {data.items.map((r) => (
            <li
              className="report-card"
              key={r.id}
              onTouchStart={(e) => {
                const p = e.touches[0];
                if (p) touch.current = { x: p.clientX, y: p.clientY };
              }}
              onTouchEnd={(e) => {
                const p = e.changedTouches[0],
                  start = touch.current;
                if (p && start && start.x - p.clientX > 70 && Math.abs(start.y - p.clientY) < 50)
                  setRemove(r.id);
                touch.current = null;
              }}
            >
              <Link href={`/${r.system}/r/${r.id}`}>
                <h2 className="type-h3">
                  {r.title
                    ? t('report.content', { text: r.title })
                    : t(`nav.${r.system === 'daily' ? 'today' : r.system}` as MessageKey)}
                </h2>
                <p className="muted">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: zone }).format(
                    new Date(r.createdAt),
                  )}
                  {scoped && applied.profile === 'all' && labelOf(r.profileId)
                    ? ` · ${t('report.historyScope.tag', { name: labelOf(r.profileId) ?? '' })}`
                    : null}
                </p>
                <p>{r.keywords.map((text) => t('report.content', { text })).join(' · ')}</p>
              </Link>
              <Button variant="ghost" onClick={() => setRemove(r.id)}>
                {t('report.delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
      {data.nextCursor ? (
        <>
          <div ref={sentinel} />
          <Button disabled={busy} action={() => load(true)}>
            {t('report.history.more')}
          </Button>
        </>
      ) : null}
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        title={t('report.delete')}
        description={t('report.deleteConfirm')}
      >
        <Button
          disabled={busy}
          action={async () => {
            if (!remove) return;
            setBusy(true);
            await deleteReadingAction(remove)
              .then((r) => {
                if (r.ok) {
                  setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== remove) }));
                  setRemove(null);
                } else setError(true);
              })
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          {t('report.delete')}
        </Button>
      </Dialog>
    </>
  );
}
