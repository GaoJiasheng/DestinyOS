'use client';
import { useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
/** Load budgeted body glyph shards after paint/idle, refreshing when client-rendered reports arrive. */
export function FontLoader() {
  const pathname = usePathname();
  useEffect(() => {
    let idle = 0,
      timer = 0,
      live = true,
      pending = false;
    const load = async () => {
      if (pending || !live) return;
      pending = true;
      try {
        const { selectBodyFonts } = await import('@/lib/font-selection');
        if (live) await selectBodyFonts();
      } catch {
        /* Native serif fallback remains readable. */
      } finally {
        pending = false;
      }
    };
    const schedule = () => {
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
    };
  }, [pathname]);
  return null;
}
