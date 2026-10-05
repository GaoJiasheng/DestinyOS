'use client';
import { useEffect } from 'react';
import type { Theme } from '@/lib/themes';
/** Apply device-wide theme and motion locks in the independent public document. */
export function PublicPreferences({ theme }: { theme: Theme }) {
  useEffect(() => {
    // DESIGN-GAP: Public snapshots have no account provider, but the documented global theme/motion locks still apply on this device.
    const update = () => {
      try {
        const saved = localStorage.getItem('tianji-theme');
        document.documentElement.dataset.theme =
          saved === 'east' || saved === 'west' ? saved : theme;
        document.documentElement.dataset.reducedMotion = String(
          localStorage.getItem('tianji-reduced-motion') === 'true',
        );
      } catch {
        // The server-rendered system theme and OS motion preference remain available.
      }
    };
    update();
    window.addEventListener('tianji-settings', update);
    return () => window.removeEventListener('tianji-settings', update);
  }, [theme]);
  return null;
}
