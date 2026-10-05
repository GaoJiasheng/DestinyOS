'use client';
import { useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
/** Load budgeted body glyph shards after paint/idle, refreshing when client-rendered reports arrive. */
export function FontLoader() {
  const pathname = usePathname();
  useEffect(() => {
    let idle = 0,
      timer = 0,
      revision = 0,
      live = true,
      pending = false;
    const load = async () => {
      if (pending || !live) return;
      pending = true;
      const current = revision;
      try {
        const { selectBodyFonts } = await import('@/lib/font-selection');
        if (live) {
          await selectBodyFonts();
          await document.fonts.ready;
          // DESIGN-GAP: Signal completion of the latest actual glyph selection so visual acceptance waits for fonts rather than capturing a transient native fallback.
          if (live && current === revision) document.documentElement.dataset.fontsSettled = 'true';
        }
      } catch {
        /* Native serif fallback remains readable. */
      } finally {
        pending = false;
      }
    };
    const schedule = () => {
      revision++;
      document.documentElement.dataset.fontsSettled = 'false';
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (typeof requestIdleCallback === 'function')
          idle = requestIdleCallback(() => void load(), { timeout: 3000 });
        else void load();
      }, 3000);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      live = false;
      observer.disconnect();
      clearTimeout(timer);
      if (idle) cancelIdleCallback(idle);
      delete document.documentElement.dataset.fontsSettled;
    };
  }, [pathname]);
  return null;
}
