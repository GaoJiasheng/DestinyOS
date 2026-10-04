'use client';
import { useFormStatus } from 'react-dom';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';

/** Show confirmation progress and prevent duplicate form submissions. */
export function ConfirmButton() {
  const { pending } = useFormStatus();
  const t = useCopy();
  return (
    <Button type="submit" disabled={pending}>
      {t(pending ? 'auth.verify.confirming' : 'auth.verify.confirm')}
    </Button>
  );
}
