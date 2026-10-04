'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { adRouteAllowed, type AdPolicy } from '@/lib/ads';
import { getAdPolicyAction } from '@/app/ads/actions';
import { readAnonymous } from '@/lib/anonymous-storage';

type AdsQueue = Array<Record<string, never>> & {
  requestNonPersonalizedAds?: number;
  tagForUnderAgeOfConsent?: number;
};
declare global {
  interface Window {
    adsbygoogle?: AdsQueue;
    googlefc?: {
      callbackQueue: Array<{ CONSENT_DATA_READY: () => void }>;
      showRevocationMessage?: () => void;
    };
  }
}
const AdsContext = createContext<{ allowed: boolean; ready: boolean }>({
  allowed: false,
  ready: false,
});
/** Access ad eligibility resolved after each navigation; never infer paid entitlements on the client. */
export function useAds() {
  return useContext(AdsContext);
}
/** Load AdSense after eligibility and minor flags are resolved, on documented content routes only. */
export function AdsProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [state, setState] = useState<{ path: string; policy: AdPolicy } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    if (!adRouteAllowed(path) || !process.env.NEXT_PUBLIC_ADSENSE_CLIENT) return;
    void (async () => {
      const policy = await getAdPolicyAction();
      const anonymous = await readAnonymous();
      if (anonymous?.profile) {
        const age = new Date().getUTCFullYear() - anonymous.profile.year;
        policy.underAge ||= age <= 18;
        policy.blocked ||= age < 13;
      }
      if (!active) return;
      if (!policy.enabled || policy.blocked || policy.plan === 'pro') {
        setState({ path, policy });
        return;
      }
      const queue = (window.adsbygoogle ??= []);
      // DESIGN-GAP: Unknown age and GPC use non-personalized/RDP ads conservatively; Google CMP remains the consent authority.
      const gpc = 'globalPrivacyControl' in navigator && navigator.globalPrivacyControl === true;
      queue.requestNonPersonalizedAds = policy.underAge || !anonymous?.profile || gpc ? 1 : 0;
      queue.tagForUnderAgeOfConsent = policy.underAge ? 1 : 0;
      setState({ path, policy });
    })().catch(() => {
      if (active) setState(null);
    });
    return () => {
      active = false;
    };
  }, [path]);
  const allowed = Boolean(
    state?.path === path &&
    state.policy.enabled &&
    state.policy.plan === 'free' &&
    !state.policy.blocked &&
    adRouteAllowed(path),
  );
  return (
    <AdsContext.Provider value={{ allowed, ready }}>
      {allowed ? (
        <Script
          id="adsense"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
          onReady={() => setReady(true)}
        />
      ) : null}
      {children}
    </AdsContext.Provider>
  );
}
