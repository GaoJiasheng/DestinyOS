'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { loginFormAction, type LoginState } from '@/app/[locale]/auth/actions';
import { retryWait } from '@/lib/retry-wait';

const resendCooldown = 60;
/** Accessible email login form with translated pending, sent, validation and rate-limit states. */
export function LoginForm({ locale }: { locale: string }) {
  const t = useCopy();
  // Validated on the server (auth/return-path.ts); passed through untouched here.
  const callbackUrl = useSearchParams().get('callbackUrl') ?? '';
  const [formState, action, formPending] = useActionState(loginFormAction, { ok: false });
  const [submittedState, setSubmittedState] = useState<LoginState>();
  const [requestPending, setRequestPending] = useState(false);
  const submitting = useRef(false);
  const state = submittedState ?? formState;
  const pending = requestPending || formPending;
  // Seconds left before another link may be requested; starts after each successful send.
  const [cooldown, setCooldown] = useState(0);
  const sentAt = state.ok ? state : null;
  useEffect(() => {
    if (!sentAt) return;
    const started = Date.now();
    setCooldown(resendCooldown);
    const timer = window.setInterval(() => {
      const left = resendCooldown - Math.floor((Date.now() - started) / 1000);
      setCooldown(Math.max(0, left));
      if (left <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);
  // DESIGN-GAP: Cookie revalidation can batch the form transition with unrelated startup Actions. Track hydrated submission by its own Promise; keep the Server Action for pre-hydration form fallback.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || cooldown > 0) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setRequestPending(true);
    try {
      setSubmittedState(await loginFormAction(state, form));
    } catch {
      setSubmittedState({ ok: false, code: 'E_INTERNAL' });
    } finally {
      submitting.current = false;
      setRequestPending(false);
    }
  };
  return (
    <form action={action} onSubmit={submit} className="auth-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label htmlFor="email">{t('auth.login.email')}</label>
      <input
        id="email"
        type="email"
        name="email"
        autoComplete="email"
        required
        maxLength={254}
        disabled={pending}
      />
      <Button type="submit" disabled={pending || cooldown > 0}>
        {pending
          ? t('auth.login.sending')
          : cooldown > 0
            ? t('auth.login.resendIn', { seconds: cooldown })
            : t(state.ok ? 'auth.login.resend' : 'auth.login.send')}
      </Button>
      <div aria-live="polite" role={state.code ? 'alert' : 'status'}>
        {state.ok &&
          `${t('auth.magic.sent', { email: state.email ?? '' })} ${t('auth.magic.sameDevice')}`}
        {state.code === 'E_VALIDATION' && t('auth.error.validation')}
        {state.code === 'E_INTERNAL' && t('auth.error.internal')}
        {state.code === 'E_RATE_LIMITED' && t('common.retryAfterWait', retryWait(state.retryAfter))}
      </div>
    </form>
  );
}
