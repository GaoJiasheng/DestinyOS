import { lazy, Suspense } from 'react';
import { useBilling } from '../lib/monetization/billing';
import { useConsent } from '../lib/monetization/consent';
import { useProfiles } from '../lib/profiles';
import { nativeAdUnit } from '../lib/monetization/ad-unit';
import { adAge } from '../lib/monetization/ad-policy';
// DESIGN-GAP: Native-free store builds must never evaluate the optional SDK; load creatives only for configured inventory.
const LoadedNativeAd = lazy(() => import('./native-ad-creative'));
/** Native inventory. No placement outside Today/reports and no user targeting payloads. */
export function NativeAdCard({ slot }: { slot: 0 | 1 }) {
  const billing = useBilling(),
    consent = useConsent();
  const { profiles, settings, loading, error } = useProfiles();
  const age = loading || error ? 'blocked' : adAge(profiles, settings.ageBlocked);
  const allowed =
    billing.status === 'ready' &&
    !billing.access.pro &&
    consent.status === 'ready' &&
    consent.age === age &&
    age !== 'blocked';
  if (!allowed || !nativeAdUnit()) return null;
  // Remount destroys loaded inventory immediately when rights/consent/age changes.
  return (
    <Suspense fallback={null}>
      <LoadedNativeAd
        key={`${billing.userId}-${age}-${consent.nonPersonalized}`}
        slot={slot}
        nonPersonalized={age !== 'adult' || consent.nonPersonalized}
      />
    </Suspense>
  );
}
