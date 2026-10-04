'use client';
import { useEffect, useRef } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { adSlotId, type AdPlacement } from '@/lib/ads';
import { useAds } from './ads-provider';
import { recordAdImpressionAction } from '@/app/ads/actions';
/** Reserve stable space for one independent AdSense container and request it only once. */
export function AdSlot({
  id,
  slot,
  format = 'auto',
  plan = 'free',
}: {
  id?: string;
  slot: AdPlacement;
  format?: 'auto' | 'fluid';
  plan?: 'free' | 'pro';
}) {
  const { allowed, ready } = useAds();
  const ref = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  const t = useCopy();
  const numeric = adSlotId(slot);
  useEffect(() => {
    if (!allowed || !ready || plan === 'pro' || !numeric || requested.current || !ref.current)
      return;
    try {
      window.adsbygoogle?.push({});
      requested.current = true;
    } catch {
      /* Ad blockers leave the reserved container stable. */
    }
  }, [allowed, ready, plan, numeric]);
  useEffect(() => {
    const element = ref.current;
    if (!element || !allowed || !ready) return;
    let counted = false;
    const observer = new MutationObserver(() => {
      if (!counted && element.dataset.adStatus === 'filled') {
        counted = true;
        void recordAdImpressionAction(slot);
      }
    });
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [allowed, ready, numeric, slot]);
  if (!allowed || plan === 'pro' || !numeric) return null;
  return (
    <aside
      id={id ?? `ad-${slot}`}
      className="ad-slot"
      aria-label={t('report.ad')}
      data-ad-placement={slot}
    >
      <span className="type-caption">{t('report.ad')}</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
        data-ad-slot={numeric}
        data-ad-format={format}
        data-full-width-responsive="true"
        data-restrict-data-processing={
          typeof navigator !== 'undefined' &&
          'globalPrivacyControl' in navigator &&
          navigator.globalPrivacyControl === true
            ? '1'
            : undefined
        }
      />
    </aside>
  );
}
