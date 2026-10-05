'use client';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
/** Advanced school selectors; callback semantics are retained by the parent form. */
export function BirthSchoolFields({
  solar,
  setSolar,
  ziHour,
  setZiHour,
  house,
  setHouse,
  leap,
  setLeap,
  setRequestId,
}: {
  solar: boolean;
  setSolar: (value: boolean) => void;
  ziHour: string;
  setZiHour: (value: string) => void;
  house: string;
  setHouse: (value: string) => void;
  leap: string;
  setLeap: (value: string) => void;
  setRequestId: (value: null) => void;
}) {
  const t = useCopy();
  return (
    <>
      <details>
        <summary>{t('form.birth.advanced')}</summary>
        <label className="birth-check">
          <input
            type="checkbox"
            checked={solar}
            onChange={(e) => {
              setSolar(e.target.checked);
              setRequestId(null);
            }}
          />
          {t('form.birth.apparentSolarTime')}
        </label>
        <label className="birth-field">
          {t('form.birth.ziHour')}
          <select
            aria-label={t('form.birth.ziHour')}
            value={ziHour}
            onChange={(e) => {
              setZiHour(e.target.value);
              setRequestId(null);
            }}
          >
            {['zi_unified', 'zi_split'].map((s) => (
              <option key={s} value={s}>
                {t(`form.birth.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="birth-field">
          {t('form.birth.houseSystem')}
          <select
            aria-label={t('form.birth.houseSystem')}
            value={house}
            onChange={(e) => setHouse(e.target.value)}
          >
            {['placidus', 'whole_sign', 'equal', 'koch'].map((h) => (
              <option key={h} value={h} disabled={h === 'koch'}>
                {t(`form.birth.house.${h}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="birth-field">
          {t('form.birth.leapRule')}
          <select
            aria-label={t('form.birth.leapRule')}
            value={leap}
            onChange={(e) => setLeap(e.target.value)}
          >
            {['split', 'current', 'next'].map((l) => (
              <option key={l} value={l}>
                {t(`form.birth.leap.${l}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
      </details>
    </>
  );
}
