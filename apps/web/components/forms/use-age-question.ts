'use client';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { blockAgeAction } from '@/app/readings/actions';
import type { FieldIssue } from '@/lib/birth-form-validate';
const underThirteen: FieldIssue = { field: 'year', key: 'form.birth.error.underThirteen' };
/** The under-13 question shared by the birth forms. "It's me" locks the session as before;
 * "someone else" continues through `onOther`, except where only the user's own birth can be
 * saved (`selfOnly`), which explains why on the year field instead. */
export function useAgeQuestion({
  onOther,
  selfOnly = false,
  focusYear,
}: {
  onOther: () => void;
  selfOnly?: boolean;
  focusYear?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<FieldIssue | null>(null);
  return {
    issue,
    clearIssue: () => setIssue(null),
    ask: () => setOpen(true),
    dialog: {
      open,
      onSelf: () => {
        setOpen(false);
        void blockAgeAction().finally(() => router.replace('/age-restricted'));
      },
      onFix: () => {
        setOpen(false);
        focusYear?.();
      },
      onOther: () => {
        setOpen(false);
        if (!selfOnly) return onOther();
        setIssue(underThirteen);
        focusYear?.();
      },
    },
  };
}
