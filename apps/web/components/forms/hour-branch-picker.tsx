'use client';
import { useId } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { hourBranches } from '@/lib/birth-form';
import type { MessageKey } from '@/i18n/catalog';
/** 13 intervals separate early and late Zi; minute entry is handled by the companion precise-clock input. */
export function HourBranchPicker({
  hour,
  onChange,
  disabled,
}: {
  hour: number;
  onChange: (hour: number) => void;
  disabled: boolean;
}) {
  const t = useCopy();
  const id = useId();
  const index = hour === 0 ? 0 : hour === 23 ? 12 : Math.floor((hour + 1) / 2);
  return (
    <label className="birth-field" htmlFor={id}>
      {t('form.birth.hourBranch')}
      <select
        id={id}
        value={hourBranches[index]}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {hourBranches.map((h, i) => (
          <option key={h} value={h}>
            {t(`form.birth.branch.${i}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
