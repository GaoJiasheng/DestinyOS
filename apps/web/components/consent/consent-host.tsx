'use client';
import { useEffect, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useCopy } from '@/i18n/use-copy';
import {
  confirmConsent,
  declineConsent,
  isConsentPromptOpen,
  subscribeConsent,
} from '@/lib/consent';
/** A failed dialog chunk (deploy skew, offline) must still ask, never skip the confirmation. */
function NativeConsent() {
  const t = useCopy();
  useEffect(() => {
    if (!isConsentPromptOpen()) return;
    if (window.confirm(`${t('legal.disclaimer.full')}\n\n${t('legal.ageConfirmation')}`))
      confirmConsent();
    else declineConsent();
  });
  return null;
}
// DESIGN-GAP: Lives in the root layout because feature routes narrow the message provider; the dialog chunk loads only when a first-time visitor starts a reading.
const ConsentDialog = dynamic(
  () =>
    import('./consent-dialog').then((module) => module.ConsentDialog).catch(() => NativeConsent),
  { ssr: false },
);
export function ConsentHost() {
  const open = useSyncExternalStore(subscribeConsent, isConsentPromptOpen, () => false);
  return open ? <ConsentDialog /> : null;
}
