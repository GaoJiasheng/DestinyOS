'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { canUseThree, reportThreeFallback } from '@/lib/three-policy';
import type { SkyPlace } from '../three/sky-position';
const StarfieldCanvas = dynamic(() => import('../three/starfield-canvas'), { ssr: false });
const origin: SkyPlace = { lat: 0, lng: 0 };
/** Mount the heavy renderer after paint/idle, using only already-authorized geolocation. */
export function HomeSky({
  reducedMotion,
  allowLocation,
}: {
  reducedMotion: boolean | null;
  allowLocation: boolean;
}) {
  const t = useCopy();
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [place, setPlace] = useState<SkyPlace>(origin);
  const reported = useRef(false);
  const fail = useCallback(() => {
    setFailed(true);
    if (!reported.current) {
      reported.current = true;
      reportThreeFallback('home', 'render-or-fps');
    }
  }, []);
  useEffect(() => {
    if (reducedMotion === null) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    const update = () => setReady(canUseThree(reducedMotion));
    let idle = 0,
      timer = 0,
      paint = 0;
    // DESIGN-GAP: Preserve desktop WebGL after first pointer/keyboard intent and idle; mobile keeps the painted galaxy and CSS animation.
    const intent = () => {
      if (matchMedia('(max-width: 767px)').matches) return;
      paint = requestAnimationFrame(() => {
        timer = window.setTimeout(() => {
          if (typeof window.requestIdleCallback === 'function')
            idle = window.requestIdleCallback(update);
          else update();
        }, 3000);
      });
    };
    window.addEventListener('pointermove', intent, { once: true });
    window.addEventListener('keydown', intent, { once: true });
    const changed = () => {
      if (document.querySelector('[data-starfield-canvas]')) update();
    };
    media.addEventListener('change', changed);
    connection?.addEventListener('change', changed);
    return () => {
      window.removeEventListener('pointermove', intent);
      window.removeEventListener('keydown', intent);
      cancelAnimationFrame(paint);
      if (idle) cancelIdleCallback(idle);
      clearTimeout(timer);
      media.removeEventListener('change', changed);
      connection?.removeEventListener('change', changed);
    };
  }, [reducedMotion]);
  useEffect(() => {
    if (!allowLocation) {
      setPlace(origin);
      return;
    }
    let live = true;
    // DESIGN-GAP: Never trigger a location permission dialog on arrival; absent authorized coordinates use UTC 0°.
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((permission) => {
        if (permission.state === 'granted')
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              if (live) setPlace({ lat: coords.latitude, lng: coords.longitude });
            },
            () => {},
            { maximumAge: 300_000, timeout: 3000 },
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [allowLocation]);
  return (
    <>
      {ready && !failed && <StarfieldCanvas place={place} onFailure={fail} />}
      <p className="sky-caption">{t(place === origin ? 'home.sky.origin' : 'home.sky.local')}</p>
    </>
  );
}
