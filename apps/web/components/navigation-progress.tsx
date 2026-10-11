'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
/** Persistent, accessible feedback for links, programmatic routing and browser history. */
export function NavigationProgress() {
  const t = useCopy();
  const pathname = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setBusy(false);
    if (timer.current) clearTimeout(timer.current);
  }, [pathname, search]);
  useEffect(() => {
    const start = () => {
      setBusy(true);
      if (timer.current) clearTimeout(timer.current);
      // DESIGN-GAP: A canceled/same-route transition has no completion event in Next 15; bound its indicator lifetime.
      timer.current = setTimeout(() => setBusy(false), 15000);
    };
    const finish = () => {
      setBusy(false);
      if (timer.current) clearTimeout(timer.current);
    };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return;
      const url = new URL(link.href);
      if (
        url.origin === location.origin &&
        (url.pathname !== location.pathname || url.search !== location.search)
      )
        start();
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method !== 'get')
        return;
      if (
        form.target !== '_blank' &&
        new URL(form.action, location.href).origin === location.origin
      )
        start();
    };
    document.addEventListener('submit', submit);
    window.addEventListener('tianji-navigation-start', start);
    window.addEventListener('tianji-navigation-finish', finish);
    window.addEventListener('popstate', start);
    document.addEventListener('click', click, true);
    setReady(true);
    return () => {
      window.removeEventListener('tianji-navigation-start', start);
      window.removeEventListener('tianji-navigation-finish', finish);
      window.removeEventListener('popstate', start);
      document.removeEventListener('click', click, true);
      document.removeEventListener('submit', submit);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return (
    <div
      className="navigation-progress"
      data-active={busy}
      data-ready={ready}
      role="progressbar"
      aria-label={t('common.loading')}
      aria-hidden={!busy}
    />
  );
}
