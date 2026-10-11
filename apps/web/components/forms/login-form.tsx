'use client';

import { useActionState, useRef, useState, type FormEvent } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { loginFormAction, type LoginState } from '@/app/[locale]/auth/actions';

/** Accessible email login form with translated pending, sent, validation and rate-limit states. */
export function LoginForm({ locale }: { locale: string }) {
  const t = useCopy();
  const [formState, action, formPending] = useActionState(loginFormAction, { ok: false });
  const [submittedState, setSubmittedState] = useState<LoginState>();
  const [requestPending, setRequestPending] = useState(false);
  const submitting = useRef(false);
  const state = submittedState ?? formState;
  const pending = requestPending || formPending;
  // DESIGN-GAP: Cookie revalidation can batch the form transition with unrelated startup Actions. Track hydrated submission by its own Promise; keep the Server Action for pre-hydration form fallback.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
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
      <Button type="submit" disabled={pending}>
        {t(pending ? 'auth.login.sending' : 'auth.login.send')}
      </Button>
      <div aria-live="polite" role={state.code ? 'alert' : 'status'}>
        {state.ok && t('auth.magic.sent', { email: state.email ?? '' })}
        {state.code === 'E_VALIDATION' && t('auth.error.validation')}
        {state.code === 'E_INTERNAL' && t('auth.error.internal')}
        {state.code === 'E_RATE_LIMITED' &&
          t('auth.error.rateLimited', { seconds: state.retryAfter ?? 1 })}
      </div>
    </form>
  );
}
