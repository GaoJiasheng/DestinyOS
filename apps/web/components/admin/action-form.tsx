'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { useCopy } from '@/i18n/use-copy';
import type { AdminState } from '@/app/admin/actions';
/** Accessible action form with pending, success and localized error feedback. */
export function AdminActionForm({
  action,
  label,
  children,
}: {
  action: (state: AdminState, form: FormData) => Promise<AdminState>;
  label: string;
  children?: React.ReactNode;
}) {
  const t = useCopy();
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="admin-action-form" aria-busy={pending}>
      {children}
      <Button disabled={pending}>{pending ? t('admin.pending') : label}</Button>
      {state.ok && <p role="status">{t('admin.saved')}</p>}
      {state.ok === false && (
        <p role="alert">{t('admin.error', { code: state.code ?? 'E_INTERNAL' })}</p>
      )}
    </form>
  );
}
