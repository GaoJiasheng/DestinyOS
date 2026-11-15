'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';

/**
 * Magic-link confirmation. `fallback` redirects on the server for pre-hydration posts; once hydrated
 * `navigate` returns the destination and the page is fully reloaded, so the shell sees the new session.
 */
export function ConfirmLoginForm({
  fallback,
  navigate,
}: {
  fallback: () => Promise<void>;
  navigate: () => Promise<string>;
}) {
  const t = useCopy();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    try {
      window.location.assign(await navigate());
    } catch {
      submitting.current = false;
      setPending(false);
      setFailed(true);
    }
  };
  return (
    <form action={fallback} onSubmit={submit}>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t(pending ? 'auth.verify.confirming' : 'auth.verify.confirm')}
      </Button>
      {failed ? <p role="alert">{t('auth.error.generic')}</p> : null}
    </form>
  );
}
