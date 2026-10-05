'use client';
import { Lunar, LunarYear } from 'lunar-typescript';
import { useLocale, useTranslations } from 'next-intl';
import { ganZhiAt } from '@tianji/engine/common';
import { useCopy } from '@/i18n/use-copy';
import { lunarMonths, lunarDayCount } from '@/lib/birth-form';
/** Real lunar month choices expose a leap month only in its actual year. */
export function LunarDatePicker({
  year,
  month,
  day,
  onChange,
}: {
  year: number;
  month: number;
  day: number;
  onChange: (month: number, day: number) => void;
}) {
  const t = useCopy();
  const locale = useLocale();
  const intl = useTranslations();
  const pair = ganZhiAt(Math.max(1900, Math.min(2100, year)) - 4);
  const validYear = Math.max(1900, Math.min(2100, year));
  const months = lunarMonths(validYear);
  const days = lunarDayCount(validYear, month);
  return (
    <>
      <label className="birth-field">
        {t('form.birth.month')}
        <select
          value={month}
          onChange={(e) => {
            const m = Number(e.target.value);
            onChange(m, Math.min(day, lunarDayCount(validYear, m)));
          }}
        >
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {t(m.month < 0 ? 'form.birth.lunar.leap' : 'form.birth.lunar.month', {
                month: Math.abs(m.month),
              })}
            </option>
          ))}
        </select>
      </label>
      <label className="birth-field">
        {t('form.birth.day')}
        <select
          value={Math.min(day, days)}
          onChange={(e) => onChange(month, Number(e.target.value))}
        >
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {t('form.birth.lunar.day', {
                day:
                  locale !== 'en'
                    ? Lunar.fromYmd(validYear, month, i + 1).getDayInChinese()
                    : String(i + 1),
              })}
            </option>
          ))}
        </select>
      </label>
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
