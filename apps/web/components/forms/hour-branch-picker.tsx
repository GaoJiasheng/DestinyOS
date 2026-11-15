'use client';
import { useCopy } from '@/i18n/use-copy';
import { hourBranches } from '@/lib/birth-form';
import type { MessageKey } from '@/i18n/catalog';
import type { FieldIssue } from '@/lib/birth-form-validate';
import { invalidProps } from './birth-form-parts';
/** 13 intervals separate early and late Zi; minute entry is handled by the companion precise-clock input.
 * Starts unselected so nobody submits a default early-Zi hour by accident. */
export function HourBranchPicker({
  id,
  hour,
  onChange,
  disabled,
  issue,
}: {
  id: string;
  hour: number | undefined;
  onChange: (hour: number | undefined) => void;
  disabled: boolean;
  issue?: FieldIssue;
}) {
  const t = useCopy();
  const index =
    hour === undefined ? -1 : hour === 0 ? 0 : hour === 23 ? 12 : Math.floor((hour + 1) / 2);
  return (
    <div className="birth-field">
      <label htmlFor={id}>{t('form.birth.hourBranch')}</label>
      <select
        id={id}
        value={index < 0 ? '' : hourBranches[index]}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        {...invalidProps(id, issue)}
      >
        <option value="" disabled>
          {t('form.birth.hourPlaceholder')}
        </option>
        {hourBranches.map((h, i) => (
          <option key={h} value={h}>
            {t(`form.birth.branch.${i}` as MessageKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
