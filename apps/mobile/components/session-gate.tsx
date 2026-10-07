import { useEffect, useRef, type ReactNode } from 'react';
import { Redirect, useSegments } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { useCopy } from '../lib/copy';
import { Page, CopyText, Action } from './native-ui';
/** Protect deep links until onboarding/age checks finish; cipher errors expose a retry, never plaintext. */
export function SessionGate({ children }: { children: ReactNode }) {
  const state = useProfiles();
  const segments = useSegments();
  const t = useCopy();
  const ageStateLoaded = useRef(false);
  useEffect(() => {
    if (!state.loading && !state.error) ageStateLoaded.current = true;
  }, [state.loading, state.error]);
  // DESIGN-GAP: Existing diagnostic routes remain directly reachable in development builds.
  if (
    (__DEV__ ||
      (process.env.EXPO_PUBLIC_M14_AUDIT === 'true' && String(segments[1]) === 'audit')) &&
    segments[0] === 'dev'
  )
    return children;
  // DESIGN-GAP: After device age validation, keep auth forms mounted across account projection reloads so their input/navigation is retained. Blocked or failed storage still hides credentials.
  if (
    segments[0] === 'auth' &&
    ageStateLoaded.current &&
    !state.settings.ageBlocked &&
    !state.error
  )
    return children;
  if (state.loading)
    return (
      <Page title="mobile.profiles.loading">
        <CopyText>{t('mobile.profiles.loading')}</CopyText>
      </Page>
    );
  if (state.error)
    return (
      <Page title="form.birth.title">
        {/* DESIGN-GAP: Native storage recovery uses device-neutral copy; the Web error mentions browser settings. */}
        <CopyText>{t('mobile.storage.error')}</CopyText>
        <Action label={t('mobile.profiles.retry')} onPress={() => void state.reload()} />
      </Page>
    );
  if (state.settings.ageBlocked && segments[0] !== 'age-restricted')
    return <Redirect href="/age-restricted" />;
  // DESIGN-GAP: HTTPS verification can precede optional onboarding only after encrypted age-gate state has loaded successfully.
  if (segments[0] === 'auth' && !state.settings.ageBlocked) return children;
  if (!state.settings.ageBlocked && state.settings.onboardingVersion < 1 && segments.length > 0)
    return <Redirect href="/" />;
  return children;
}
