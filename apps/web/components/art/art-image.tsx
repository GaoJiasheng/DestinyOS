'use client';
import { useEffect, useRef, useState } from 'react';
import type { ArtAssetId } from '@tianji/ui-core/art';

/** Responsive generated artwork with explicit WebP and PNG fallback, without a runtime optimizer. */
export function ArtImage({
  asset,
  alt,
  className,
  sizes = '100vw',
  priority = false,
  maxWidth,
  width = 1024,
  height = width,
}: {
  asset: ArtAssetId;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  maxWidth?: number;
  width?: number;
  height?: number;
}) {
  // DESIGN-GAP: Callers pass non-default canvas dimensions, like next/image; the shared 1024px state/spread canvas avoids sending the full registry with the homepage.
  const host = useRef<HTMLPictureElement>(null);
  const [visible, setVisible] = useState(priority);
  const enabled = priority || visible;
  const stem = `/art/${asset}`;
  const sources = (['-small', '-medium', ''] as const).flatMap((suffix, index) => {
    const pixels = Math.round(width / 2 ** (2 - index));
    return index === 0 || !maxWidth || pixels <= maxWidth
      ? [`${stem}${suffix}.webp ${pixels}w`]
      : [];
  });
  useEffect(() => {
    if (priority || visible) return;
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    // DESIGN-GAP: Browser-native lazy loading may fetch several screens ahead; a 200px observation margin keeps offscreen paintings out of the initial image budget.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [priority, visible]);
  // DESIGN-GAP: Static 1/4 and 1/2 WebP derivatives bound transfer on Workers and support the same URLs in native clients.
  return (
    <picture className={className} ref={host} data-art={asset}>
      <source type="image/webp" srcSet={enabled ? sources.join(', ') : undefined} sizes={sizes} />
      <img
        src={enabled ? `${stem}.png` : undefined}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  );
}
