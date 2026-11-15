'use client';
import type { BirthInput, System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { switchCalendar } from '@/lib/birth-form';
import type { BirthField, FieldIssue } from '@/lib/birth-form-validate';
import { Button } from '@/components/ui/button';
import { ZiweiTimeRequired } from '@/components/charts/ziwei-grid';
import { HourBranchPicker } from './hour-branch-picker';
import { LunarDatePicker } from './lunar-date-picker';
import { FieldErrors, invalidProps } from './birth-form-parts';
/** Digits only; an empty field is stored as 0 so the form can show a placeholder instead of a default. */
const digits = (value: string) => Number(value.replace(/\D/g, '').slice(0, 4)) || 0;
/** Date and time step; the parent retains validation, focus and rectification navigation. */
export function BirthDateFields({
  birth,
  change,
  changeYear,
  precise,
  setPrecise,
  busy,
  canRectify,
  openRectification,
  system,
  profileMode,
  ids,
  issues,
  onBlurField,
  selfAutofill,
}: {
  birth: BirthInput;
  change: (patch: Partial<BirthInput>) => void;
  changeYear: (year: number) => void;
  precise: boolean;
  setPrecise: (value: boolean) => void;
  busy: boolean;
  canRectify: boolean;
  openRectification: () => Promise<void>;
  system: Exclude<System, 'daily'>;
  profileMode: boolean;
  ids: Record<BirthField, string>;
  issues: FieldIssue[];
  onBlurField: (field: BirthField) => void;
  /** Birthday autofill only makes sense when the form describes the person using the device. */
  selfAutofill: boolean;
}) {
  const t = useCopy();
  const issue = (field: BirthField) => issues.find((i) => i.field === field);
  const dateIssues = issues.filter((i) => i.field !== 'hour');
  const numberField = (field: 'year' | 'month' | 'day', autoComplete: string) => (
    <div className="birth-field">
      <label htmlFor={ids[field]}>{t(`form.birth.${field}`)}</label>
      <input
        id={ids[field]}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={field === 'year' ? 4 : 2}
        enterKeyHint="next"
        autoComplete={selfAutofill ? autoComplete : 'off'}
        placeholder={t(`form.birth.placeholder.${field}` as MessageKey)}
        value={birth[field] || ''}
        onBlur={() => onBlurField(field)}
        onChange={(e) =>
          field === 'year'
            ? changeYear(digits(e.target.value))
            : change({ [field]: digits(e.target.value) })
        }
        {...invalidProps(ids[field], issue(field))}
      />
    </div>
  );
  return (
    <>
      <div className="birth-segment" role="group" aria-label={t('form.birth.dateTime')}>
        {(['gregorian', 'lunar'] as const).map((c) => (
          <Button
            key={c}
            type="button"
            variant={birth.calendar === c ? 'default' : 'secondary'}
            aria-pressed={birth.calendar === c}
            onClick={() => {
              const patch = switchCalendar(birth, c);
              if (patch) change(patch);
            }}
          >
            {t(`form.birth.calendar.${c}`)}
          </Button>
        ))}
      </div>
      <div className="birth-grid">
        {numberField('year', 'bday-year')}
        {birth.calendar === 'lunar' ? (
          <LunarDatePicker
            year={birth.year}
            month={birth.isLeapMonth ? -birth.month : birth.month}
            day={birth.day}
            ids={ids}
            issues={issues}
            onBlurField={onBlurField}
            onChange={(m, d) => change({ month: Math.abs(m), day: d, isLeapMonth: m < 0 })}
          />
        ) : (
          <>
            {numberField('month', 'bday-month')}
            {numberField('day', 'bday-day')}
          </>
        )}
      </div>
      <FieldErrors issues={dateIssues} ids={ids} />
      <label className="birth-check">
        <input
          type="checkbox"
          checked={precise}
          disabled={birth.timeUnknown}
          onChange={(e) => setPrecise(e.target.checked)}
        />
        {t('form.birth.precise')}
      </label>
      {precise ? (
        <div className="birth-field">
          <label htmlFor={ids.hour}>{t('form.birth.time')}</label>
          <input
            id={ids.hour}
            type="time"
            enterKeyHint="next"
            disabled={birth.timeUnknown}
            value={
              birth.hour === undefined
                ? ''
                : `${String(birth.hour).padStart(2, '0')}:${String(birth.minute ?? 0).padStart(2, '0')}`
            }
            onChange={(e) => {
              if (!e.target.value) return change({ hour: undefined, minute: undefined });
              const [hour, minute] = e.target.value.split(':').map(Number);
              change({ hour, minute });
            }}
            {...invalidProps(ids.hour, issue('hour'))}
          />
        </div>
      ) : (
        <HourBranchPicker
          id={ids.hour}
          hour={birth.hour}
          onChange={(hour) => change({ hour, minute: hour === undefined ? undefined : 0 })}
          disabled={birth.timeUnknown}
          issue={issue('hour')}
        />
      )}
      <FieldErrors issues={issues.filter((i) => i.field === 'hour')} ids={ids} />
      <label className="birth-check">
        <input
          type="checkbox"
          checked={birth.timeUnknown}
          onChange={(e) => change({ timeUnknown: e.target.checked })}
        />
        {t('form.birth.timeUnknown')}
      </label>
      {birth.timeUnknown ? (
        <div className="notice">
          <p>{t('form.birth.timeUnknown.help')}</p>
          {canRectify ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void openRectification()}
            >
              {t('rectification.entry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {birth.timeUnknown && system === 'ziwei' && !profileMode ? (
        <ZiweiTimeRequired onRectify={() => void openRectification()} />
      ) : null}
    </>
  );
}
