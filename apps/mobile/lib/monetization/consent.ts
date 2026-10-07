import { create } from 'zustand';
import type { AdAge } from './ad-policy';
export interface ConsentPort {
  gather(
    underAge: boolean,
  ): Promise<{ canRequest: boolean; personalized: boolean; privacyRequired: boolean }>;
  privacy(): Promise<void>;
  att(): Promise<boolean>;
  initialize(underAge: boolean, nonPersonalized: boolean): Promise<void>;
}
interface ConsentState {
  age: AdAge;
  status: 'idle' | 'loading' | 'ready' | 'error';
  nonPersonalized: boolean;
  privacyRequired: boolean;
  diagnostic: boolean;
}
export const useConsent = create<ConsentState>(() => ({
  age: 'unknown',
  status: 'idle',
  nonPersonalized: true,
  privacyRequired: false,
  diagnostic: false,
}));
let port: ConsentPort | undefined;
let generation = 0;
let queue = Promise.resolve();
/** Reset display synchronously before gathering UMP, requesting ATT, then initializing ads, in that order. */
export function gatherAdConsent(age: AdAge, reopen = false) {
  const epoch = ++generation;
  useConsent.setState({ age, status: 'loading', nonPersonalized: true });
  const run = queue.then(async () => {
    if (epoch !== generation) return;
    if (age === 'blocked') {
      useConsent.setState({ status: 'idle' });
      return;
    }
    try {
      if (!port) {
        const { nativeConsent } = await import('./native-consent');
        port = nativeConsent;
      }
      if (reopen) await port.privacy();
      const underAge = age !== 'adult';
      const consent = await port.gather(underAge);
      if (epoch !== generation) return;
      useConsent.setState({ privacyRequired: consent.privacyRequired });
      if (!consent.canRequest) {
        useConsent.setState({ status: 'idle' });
        return;
      }
      // ATT denial is never a content gate. UMP refusal/unknown age never triggers tracking authorization.
      const tracking = !underAge && consent.personalized ? await port.att() : false;
      if (epoch !== generation) return;
      const nonPersonalized = underAge || !consent.personalized || !tracking;
      await port.initialize(underAge, nonPersonalized);
      if (epoch === generation) useConsent.setState({ status: 'ready', nonPersonalized });
    } catch {
      // DESIGN-GAP: Consent network failures fail closed; the explicit privacy retry can recover without guessing regional consent.
      if (epoch === generation) useConsent.setState({ status: 'error' });
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
/** Install deterministic UMP/ATT responses only in the explicit development diagnostics route. */
export function configureConsentDiagnostic(value: ConsentPort) {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  generation++;
  port = value;
  useConsent.setState({ status: 'idle', diagnostic: true });
}
