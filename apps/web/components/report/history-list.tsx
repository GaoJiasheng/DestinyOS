'use client';
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
/** Owner history with server-side search/filter, bounded infinite pagination and confirmed swipe deletion. */
export function HistoryList({ initial }: { initial: Page }) {
  const t = useCopy(),
    locale = useLocale(),
    [data, setData] = useState(initial),
    [system, setSystem] = useState(''),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [remove, setRemove] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null),
    lock = useRef(false),
    generation = useRef(0),
    touch = useRef<{ x: number; y: number } | null>(null);
  const load = useCallback(
    async (append: boolean) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError(false);
      const current = generation.current;
      try {
        const r = await listReadingsAction({
          limit: 20,
          ...(system ? { system } : {}),
          ...(search ? { search } : {}),
          ...(append && data.nextCursor ? { cursor: data.nextCursor } : {}),
        });
        if (current !== generation.current) return;
        if (r.ok)
          setData((d) => ({
            items: append ? [...d.items, ...r.data.items] : r.data.items,
            nextCursor: r.data.nextCursor,
          }));
        else setError(true);
      } catch {
        setError(true);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [system, search, data.nextCursor],
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
  return (
    <>
      <form
        className="history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          generation.current++;
          void load(false);
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
        <label>
          {t('me.history.search')}
          <input maxLength={120} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button disabled={busy}>{t('me.history.search')}</Button>
      </form>
      {!data.items.length ? (
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
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
                    new Date(r.createdAt),
                  )}
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
          <Button disabled={busy} onClick={() => void load(true)}>
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
          onClick={() => {
            if (!remove) return;
            setBusy(true);
            void deleteReadingAction(remove)
              .then((r) => {
                if (r.ok) {
                  setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== remove) }));
                  setRemove(null);
                } else setError(true);
              })
              .finally(() => setBusy(false));
          }}
        >
          {t('report.delete')}
        </Button>
      </Dialog>
    </>
  );
}
