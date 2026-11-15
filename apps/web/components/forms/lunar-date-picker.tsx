'use client';
import { LunarUtil, LunarYear } from 'lunar-typescript';
import { useLocale, useTranslations } from 'next-intl';
import { ganZhiAt } from '@tianji/engine/common';
import { useCopy } from '@/i18n/use-copy';
import { lunarMonths, lunarDayCount } from '@/lib/birth-form';
import type { BirthField, FieldIssue } from '@/lib/birth-form-validate';
import { invalidProps } from './birth-form-parts';
/** Real lunar month choices expose a leap month only in its actual year; month 0 / day 0 mean not chosen yet. */
export function LunarDatePicker({
  year,
  month,
  day,
  ids,
  issues,
  onBlurField,
  onChange,
}: {
  year: number;
  month: number;
  day: number;
  ids: Record<BirthField, string>;
  issues: FieldIssue[];
  onBlurField: (field: BirthField) => void;
  onChange: (month: number, day: number) => void;
}) {
  const t = useCopy();
  const locale = useLocale();
  const intl = useTranslations();
  const pair = ganZhiAt(Math.max(1900, Math.min(2100, year)) - 4);
  const validYear = Math.max(1900, Math.min(2100, year));
  const months = lunarMonths(validYear);
  const days = month ? lunarDayCount(validYear, month) : 30;
  const issue = (field: BirthField) => issues.find((i) => i.field === field);
  return (
    <>
      <div className="birth-field">
        <label htmlFor={ids.month}>{t('form.birth.month')}</label>
        <select
          id={ids.month}
          value={months.some((m) => m.month === month) ? month : ''}
          onBlur={() => onBlurField('month')}
          onChange={(e) => {
            const m = Number(e.target.value);
            onChange(m, day ? Math.min(day, lunarDayCount(validYear, m)) : 0);
          }}
          {...invalidProps(ids.month, issue('month'))}
        >
          <option value="" disabled>
            {t('form.birth.lunar.choose')}
          </option>
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {t(m.month < 0 ? 'form.birth.lunar.leap' : 'form.birth.lunar.month', {
                month: Math.abs(m.month),
              })}
            </option>
          ))}
        </select>
      </div>
      <div className="birth-field">
        <label htmlFor={ids.day}>{t('form.birth.day')}</label>
        <select
          id={ids.day}
          value={day >= 1 && day <= days ? day : ''}
          onBlur={() => onBlurField('day')}
          onChange={(e) => onChange(month, Number(e.target.value))}
          {...invalidProps(ids.day, issue('day'))}
        >
          <option value="" disabled>
            {t('form.birth.lunar.choose')}
          </option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {t('form.birth.lunar.day', {
                day: locale !== 'en' ? (LunarUtil.DAY[i + 1] ?? String(i + 1)) : String(i + 1),
              })}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        {t('form.birth.lunar.year', {
          year: validYear,
          ganzhi:
            locale !== 'en'
              ? LunarYear.fromYear(validYear).getGanZhi()
              : `${intl(`bazi.stems.${pair.stem}`)} ${intl(`bazi.branches.${pair.branch}`)}`,
        })}
      </p>
    </>
  );
}
