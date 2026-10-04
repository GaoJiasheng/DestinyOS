'use client';

import { useActionState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { loginFormAction } from '@/app/[locale]/auth/actions';

/** Accessible email login form with translated pending, sent, validation and rate-limit states. */
export function LoginForm({ locale }: { locale: string }) {
  const t = useCopy();
  const [state, action, pending] = useActionState(loginFormAction, { ok: false });
  return (
    <form action={action} className="auth-form">
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
