'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { logoutAction, logoutTargetAction } from '@/app/[locale]/auth/actions';
import { unsubscribePushAction } from '@/app/me/push-actions';

const pushCleanupMs = 3000;

/** Drop this browser's daily reminder so a shared device stops receiving it; never blocks sign-out. */
async function dropPushSubscription(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const cleanup = (async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    // The server row must go while the session still exists; the browser side is dropped regardless.
    await unsubscribePushAction(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
  })().catch(() => undefined);
  await Promise.race([
    cleanup,
    new Promise<void>((resolve) => window.setTimeout(resolve, pushCleanupMs)),
  ]);
}

/**
 * Sign-out control. Before hydration the form posts natively to the redirecting action; once
 * hydrated it reloads the destination so the shell's signed-in state cannot outlive the session.
 */
export function LogoutButton({
  locale,
  label,
  className,
  variant,
}: {
  locale: string;
  /** Server-translated label: `auth.*` is not in the shell message subset on account pages. */
  label: string;
  className?: string;
  variant?: 'default' | 'secondary';
}) {
  const t = useCopy();
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    await dropPushSubscription();
    try {
      window.location.assign(await logoutTargetAction(locale));
    } catch {
      // The session is still valid; let the person try again.
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <form action={logoutAction.bind(null, locale)} onSubmit={submit} className={className}>
      <Button variant={variant} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t('common.loading') : label}
      </Button>
    </form>
  );
}
