'use client';

import { useActionState, useRef, useState, type FormEvent } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import {
  loginCodeFormAction,
  verifyLoginCodeAction,
  type CodeState,
} from '@/app/[locale]/auth/code-actions';
import { retryWait } from '@/lib/retry-wait';

/**
 * Six-digit code entry shown after a sign-in email is sent, so someone reading the email on another
 * device can still finish signing in here. Success reloads the page so the shell sees the session.
 */
export function LoginCodeForm({ locale, email }: { locale: string; email: string }) {
  const t = useCopy();
  const [fallbackState, fallbackAction] = useActionState(loginCodeFormAction, { ok: false });
  const [state, setState] = useState<CodeState>();
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const shown = state ?? fallbackState;
  const exhausted = shown.code === 'E_CODE' && shown.attemptsLeft === 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!/^\d{6}$/.test(value)) {
      setState({ ok: false, code: 'E_FORMAT' });
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const result = await verifyLoginCodeAction(locale, email, value);
      if (result.ok && result.target) {
        window.location.assign(result.target);
        return;
      }
      setState(result);
      setValue('');
    } catch {
      setState({ ok: false, code: 'E_INTERNAL' });
    }
    submitting.current = false;
    setPending(false);
  };
  const message =
    shown.code === 'E_FORMAT'
      ? t('auth.code.format')
      : exhausted
        ? t('auth.code.exhausted')
        : shown.code === 'E_CODE'
          ? shown.attemptsLeft
            ? t('auth.code.attemptsLeft', { count: shown.attemptsLeft })
            : t('auth.code.invalid')
          : shown.code === 'E_RATE_LIMITED'
            ? t('common.retryAfterWait', retryWait(shown.retryAfter))
            : shown.code === 'E_INTERNAL'
              ? t('auth.error.generic')
              : null;
  return (
    <form action={fallbackAction} onSubmit={submit} className="auth-form" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email} />
      <label htmlFor="login-code">{t('auth.code.label')}</label>
      <p id="login-code-hint">{t('auth.code.hint')}</p>
      <input
        id="login-code"
        name="code"
        className="auth-code-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        // Pasted codes may carry spaces or dashes; keep only the first six digits.
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-describedby={message ? 'login-code-hint login-code-error' : 'login-code-hint'}
        aria-invalid={message ? true : undefined}
        disabled={pending || exhausted}
        required
      />
      <Button type="submit" disabled={pending || exhausted} aria-busy={pending}>
        {t(pending ? 'auth.code.submitting' : 'auth.code.submit')}
      </Button>
      {message ? (
        <p id="login-code-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
