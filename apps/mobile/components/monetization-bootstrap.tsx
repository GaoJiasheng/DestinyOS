import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAccount } from '../lib/account/controller';
import {
  identifyBilling,
  refreshBilling,
  expireBilling,
  useBilling,
} from '../lib/monetization/billing';
import { gatherAdConsent, useConsent } from '../lib/monetization/consent';
import { adAge } from '../lib/monetization/ad-policy';
import { useProfiles } from '../lib/profiles';
/** Account-bound entitlement refresh and first-start consent share the loaded encrypted age gate. */
export function MonetizationBootstrap() {
  const user = useAccount((s) => s.session?.userId ?? null);
  const { profiles, settings, loading, error } = useProfiles();
  const pro = useBilling((s) => s.access.pro);
  const diagnostic = useConsent((s) => s.diagnostic);
  const age = loading || error ? 'blocked' : adAge(profiles, settings.ageBlocked);
  useEffect(() => {
    void identifyBilling(user);
  }, [user]);
  useEffect(() => {
    // DESIGN-GAP: Explicit development fixtures own consent transitions; profile reload effects must not cancel their native ATT request.
    if (diagnostic || loading || error || settings.onboardingVersion < 1 || pro) return;
    void gatherAdConsent(age);
  }, [age, loading, error, settings.onboardingVersion, pro, diagnostic]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        expireBilling();
        void refreshBilling();
      }
    });
    // DESIGN-GAP: Check expiration each minute, refreshing cached rights on foreground without polling paid services.
    const timer = setInterval(expireBilling, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  return null;
}
