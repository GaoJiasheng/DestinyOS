'use client';
import { useEffect, useState } from 'react';
/** Combine the OS accessibility preference with the account/device motion lock. */
export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      let saved = false;
      try {
        saved = localStorage.getItem('tianji-reduced-motion') === 'true';
      } catch {
        // DESIGN-GAP: Restricted device storage keeps the OS accessibility preference available.
      }
      setReduced(media.matches || saved);
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('tianji-settings', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('tianji-settings', update);
    };
  }, []);
  return reduced;
}
