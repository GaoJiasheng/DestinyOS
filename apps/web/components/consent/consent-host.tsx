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
import { notifyInfo } from '@/lib/notify';
import { anonymousEvictionEvent, type AnonymousEviction } from '@/lib/anonymous-encoding';
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
/** Tell the visitor when a full device store forced old readings out (lib/anonymous-storage). */
function useEvictionNotice() {
  const t = useCopy();
  useEffect(() => {
    const notify = (event: Event) => {
      const count = (event as CustomEvent<AnonymousEviction>).detail?.count ?? 1;
      notifyInfo(t('me.storage.evicted', { count }));
    };
    window.addEventListener(anonymousEvictionEvent, notify);
    return () => window.removeEventListener(anonymousEvictionEvent, notify);
  }, [t]);
}
// DESIGN-GAP: The storage-eviction notice shares this always-mounted root host instead of adding another layout child.
export function ConsentHost() {
  useEvictionNotice();
  const open = useSyncExternalStore(subscribeConsent, isConsentPromptOpen, () => false);
  return open ? <ConsentDialog /> : null;
}
