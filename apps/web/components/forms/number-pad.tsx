'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
/** Keyboard-accessible 1–999 number pad accepting two required numbers and one optional number. */
export function NumberPad({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useTranslations('divination');
  const [active, setActive] = useState(0);
  const edit = (value: string) => onChange(values.map((v, i) => (i === active ? value : v)));
  return (
    <div>
      <p>{t('numbersHelp')}</p>
      <div className="birth-grid">
        {values.map((value, i) => (
          <label className="birth-field" key={i}>
            {t('number', { number: i + 1 })}
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={value}
              onFocus={() => setActive(i)}
              onChange={(e) =>
                onChange(
                  values.map((v, j) =>
                    j === i ? e.target.value.replace(/\D/g, '').slice(0, 3) : v,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
      <div className="number-pad" role="group" aria-label={t('numberPad')}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
          <Button
            key={key}
            type="button"
            variant="secondary"
            onClick={() =>
              edit(
                key === 'clear'
                  ? ''
                  : key === 'backspace'
                    ? values[active]!.slice(0, -1)
                    : (values[active] + key).slice(0, 3),
              )
            }
          >
            {key === 'clear' || key === 'backspace' ? t(key) : key}
          </Button>
        ))}
      </div>
    </div>
  );
}
