'use client';
import { useId } from 'react';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import type { FieldIssue } from '@/lib/birth-form-validate';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
export type BirthTarget = 'self' | 'other';
/** Lets a guest with a saved device profile chart someone else without overwriting it. */
export function BirthTargetChoice({
  value,
  onChange,
}: {
  value: BirthTarget;
  onChange: (value: BirthTarget) => void;
}) {
  const t = useCopy();
  const name = useId();
  return (
    <fieldset className="birth-target">
      <legend>{t('form.birth.for.legend')}</legend>
      {(['self', 'other'] as const).map((option) => (
        <label className="birth-check" key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {t(`form.birth.for.${option}`)}
        </label>
      ))}
    </fieldset>
  );
}
/** Asks before the under-13 session lock; the lock threshold itself is unchanged. */
export function AgeConfirmDialog({
  open,
  onSelf,
  onOther,
}: {
  open: boolean;
  onSelf: () => void;
  onOther: () => void;
}) {
  const t = useCopy();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOther();
      }}
      required
      title={t('form.birth.ageCheck.title')}
      description={t('form.birth.ageCheck.body')}
    >
      <div className="hero-actions birth-actions">
        <Button type="button" onClick={onSelf}>
          {t('form.birth.ageCheck.self')}
        </Button>
        <Button type="button" variant="secondary" onClick={onOther}>
          {t('form.birth.ageCheck.other')}
        </Button>
      </div>
    </Dialog>
  );
}
/** Stable id of a field's inline error, referenced by aria-describedby. */
export const errorId = (fieldId: string) => `${fieldId}-error`;
/** Inline messages for one field group; each line carries the id of the field it describes. */
export function FieldErrors({
  issues,
  ids,
}: {
  issues: FieldIssue[];
  ids: Partial<Record<FieldIssue['field'], string>>;
}) {
  const t = useCopy();
  if (!issues.length) return null;
  return (
    <>
      {issues.map((issue) => (
        <p
          key={issue.field}
          id={ids[issue.field] ? errorId(ids[issue.field]!) : undefined}
          className="form-error field-error"
        >
          {t(issue.key as MessageKey, issue.params)}
        </p>
      ))}
    </>
  );
}
/** Accessibility attributes for a control whose issue may be visible. */
export function invalidProps(id: string, issue: FieldIssue | undefined) {
  return issue ? { 'aria-invalid': true as const, 'aria-describedby': errorId(id) } : {};
}
