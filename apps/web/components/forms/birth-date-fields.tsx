'use client';
import type { BirthInput, System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { ZiweiTimeRequired } from '@/components/charts/ziwei-grid';
import { HourBranchPicker } from './hour-branch-picker';
import { LunarDatePicker } from './lunar-date-picker';
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
}) {
  const t = useCopy();
  return (
    <>
      <div className="birth-segment" role="group" aria-label={t('form.birth.dateTime')}>
        {(['gregorian', 'lunar'] as const).map((c) => (
          <Button
            key={c}
            type="button"
            variant={birth.calendar === c ? 'default' : 'secondary'}
            aria-pressed={birth.calendar === c}
            onClick={() =>
              change({ calendar: c, isLeapMonth: false, day: Math.min(birth.day, 28) })
            }
          >
            {t(`form.birth.calendar.${c}`)}
          </Button>
        ))}
      </div>
      <div className="birth-grid">
        <label className="birth-field">
          {t('form.birth.year')}
          <input
            type="number"
            min={1900}
            max={2100}
            required
            value={birth.year || ''}
            onChange={(e) => changeYear(Number(e.target.value))}
          />
        </label>
        {birth.calendar === 'lunar' ? (
          <LunarDatePicker
            year={birth.year}
            month={birth.isLeapMonth ? -birth.month : birth.month}
            day={birth.day}
            onChange={(m, d) => change({ month: Math.abs(m), day: d, isLeapMonth: m < 0 })}
          />
        ) : (
          <>
            <label className="birth-field">
              {t('form.birth.month')}
              <input
                type="number"
                min={1}
                max={12}
                required
                value={birth.month}
                onChange={(e) => change({ month: Number(e.target.value) })}
              />
            </label>
            <label className="birth-field">
              {t('form.birth.day')}
              <input
                type="number"
                min={1}
                max={31}
                required
                value={birth.day}
                onChange={(e) => change({ day: Number(e.target.value) })}
              />
            </label>
          </>
        )}
      </div>
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
        <label className="birth-field">
          {t('form.birth.time')}
          <input
            type="time"
            disabled={birth.timeUnknown}
            value={`${String(birth.hour ?? 0).padStart(2, '0')}:${String(birth.minute ?? 0).padStart(2, '0')}`}
            onChange={(e) => {
              const [hour, minute] = e.target.value.split(':').map(Number);
              change({ hour, minute });
            }}
          />
        </label>
      ) : (
        <HourBranchPicker
          hour={birth.hour ?? 0}
          onChange={(hour) => change({ hour, minute: 0 })}
          disabled={birth.timeUnknown}
        />
      )}
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
