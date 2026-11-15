'use client';
import type { BirthInput } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { School } from '@/lib/birth-form-submit';
import { BirthSchoolFields } from './birth-school-fields';
/** Step-two gender, display name and school options. */
export function BirthPersonFields({
  gender,
  onGender,
  name,
  onName,
  school,
  setSchool,
}: {
  gender: BirthInput['gender'];
  onGender: (gender: BirthInput['gender']) => void;
  name: string;
  onName: (name: string) => void;
  school: School;
  setSchool: (school: School) => void;
}) {
  const t = useCopy();
  return (
    <>
      <label className="birth-field">
        {t('form.birth.gender')}
        <select
          aria-label={t('form.birth.gender')}
          value={gender}
          onChange={(e) => onGender(e.target.value as BirthInput['gender'])}
        >
          {(['male', 'female', 'unspecified'] as const).map((g) => (
            <option key={g} value={g}>
              {t(`form.birth.gender.${g}`)}
            </option>
          ))}
        </select>
      </label>
      {gender === 'unspecified' ? (
        <p className="muted">{t('form.birth.gender.unspecified.note')}</p>
      ) : null}
      <label className="birth-field">
        {t('form.birth.displayName')}
        <input
          maxLength={80}
          enterKeyHint="go"
          autoComplete="off"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      <BirthSchoolFields
        solar={school.solar}
        setSolar={(solar) => setSchool({ ...school, solar })}
        ziHour={school.ziHour}
        setZiHour={(ziHour) => setSchool({ ...school, ziHour })}
        house={school.house}
        setHouse={(house) => setSchool({ ...school, house })}
        leap={school.leap}
        setLeap={(leap) => setSchool({ ...school, leap })}
        setRequestId={() => undefined}
      />
    </>
  );
}
