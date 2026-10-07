import { useState } from 'react';
import { View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LunarYear } from 'lunar-typescript';
import type { BirthInput } from '@tianji/shared';
import type { MessageKey } from '../lib/i18n';
import { hourBranches, lunarMonths, monthDays } from '../lib/birth-form';
import { useCopy } from '../lib/copy';
import { useNativePickers } from './native-pickers';
import { Action, CopyText, Field } from './native-ui';
/** Native civil/lunar date wheels, precise clock and explicit unknown-time mode. */
export function BirthDateFields({
  birth,
  year,
  setYear,
  change,
  updateDate,
}: {
  birth: BirthInput;
  year: string;
  setYear: (year: string) => void;
  change: (patch: Partial<BirthInput>) => void;
  updateDate: (patch: Partial<BirthInput>) => void;
}) {
  const t = useCopy();
  const { wheel, toggle } = useNativePickers();
  const [precise, setPrecise] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const yearValid = birth.year >= 1900 && birth.year <= 2100;
  const months =
    birth.calendar === 'lunar' && yearValid
      ? lunarMonths(birth.year)
      : Array.from({ length: 12 }, (_, i) => ({ month: i + 1, days: 31 }));
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['gregorian', 'lunar'] as const).map((calendar) => (
          <Action
            key={calendar}
            id={`calendar-${calendar}`}
            label={t(`form.birth.calendar.${calendar}`)}
            selected={birth.calendar === calendar}
            onPress={() => updateDate({ calendar })}
          />
        ))}
      </View>
      <Field
        id="birth-year"
        label={t('form.birth.year')}
        value={year}
        numeric
        maxLength={4}
        onChange={(value) => {
          setYear(value);
          updateDate({ year: /^\d{4}$/.test(value) ? Number(value) : 0 });
        }}
      />
      {birth.calendar === 'lunar' && yearValid && (
        <CopyText>
          {t('form.birth.lunar.year', {
            year: birth.year,
            ganzhi: LunarYear.fromYear(birth.year).getGanZhi(),
          })}
        </CopyText>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {wheel(
          t('form.birth.month'),
          birth.isLeapMonth ? -birth.month : birth.month,
          (value) => updateDate({ month: Math.abs(Number(value)), isLeapMonth: Number(value) < 0 }),
          months.map(({ month }) => ({
            value: month,
            label: t(month < 0 ? 'form.birth.lunar.leap' : 'form.birth.lunar.month', {
              month: Math.abs(month),
            }),
          })),
          'birth-month',
        )}
        {wheel(
          t('form.birth.day'),
          birth.day,
          (value) => change({ day: Number(value) }),
          Array.from({ length: monthDays(birth) }, (_, i) => ({
            value: i + 1,
            label: t('form.birth.lunar.day', { day: i + 1 }),
          })),
          'birth-day',
        )}
      </View>
      {birth.calendar === 'gregorian' && (
        <>
          <Action
            id="birth-date-open"
            label={t('form.birth.dateTime')}
            onPress={() => setDatePicker(!datePicker)}
          />
          {datePicker && (
            <DateTimePicker
              testID="birth-date"
              value={
                new Date(
                  Date.UTC(
                    yearValid ? birth.year : new Date().getUTCFullYear(),
                    birth.month - 1,
                    birth.day,
                    12,
                  ),
                )
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="dark"
              timeZoneName="UTC"
              minimumDate={new Date('1900-01-01')}
              maximumDate={new Date('2100-12-31')}
              onDismiss={() => setDatePicker(false)}
              onValueChange={(_event, date) => {
                if (Platform.OS === 'android') setDatePicker(false);
                if (date) {
                  setYear(String(date.getUTCFullYear()));
                  updateDate({
                    year: date.getUTCFullYear(),
                    month: date.getUTCMonth() + 1,
                    day: date.getUTCDate(),
                  });
                }
              }}
            />
          )}
        </>
      )}
      {toggle(
        t('form.birth.timeUnknown'),
        birth.timeUnknown,
        (timeUnknown) => change({ timeUnknown }),
        'time-unknown',
      )}
      {birth.timeUnknown && (
        <CopyText testID="unknown-help">{t('form.birth.timeUnknown.help')}</CopyText>
      )}
      <View
        pointerEvents={birth.timeUnknown ? 'none' : 'auto'}
        accessibilityElementsHidden={birth.timeUnknown}
        style={{ opacity: birth.timeUnknown ? 0.4 : 1 }}
      >
        {toggle(t('form.birth.precise'), precise, setPrecise, 'time-precise', !birth.timeUnknown)}
        {/* DESIGN-GAP: Full-width branches keep ranges readable; remount on mode changes
            because iOS Picker selection overlays retain their prior column width. */}
        <View
          key={precise ? 'precise' : 'branches'}
          style={{ flexDirection: precise ? 'row' : 'column', gap: 8 }}
        >
          {precise
            ? wheel(
                t('form.birth.hour'),
                birth.hour ?? 0,
                (value) => change({ hour: Number(value) }),
                Array.from({ length: 24 }, (_, i) => ({
                  value: i,
                  label: String(i).padStart(2, '0'),
                })),
                'birth-hour',
                !birth.timeUnknown,
              )
            : wheel(
                t('form.birth.hourBranch'),
                hourBranches.filter((hour) => hour <= (birth.hour ?? 0)).at(-1) ?? 0,
                (value) => change({ hour: Number(value) }),
                hourBranches.map((hour, index) => ({
                  value: hour,
                  label: t(`form.birth.branch.${index}` as MessageKey),
                })),
                'birth-branch',
                !birth.timeUnknown,
              )}
          {wheel(
            t('form.birth.minute'),
            birth.minute ?? 0,
            (value) => change({ minute: Number(value) }),
            Array.from({ length: 60 }, (_, i) => ({
              value: i,
              label: String(i).padStart(2, '0'),
            })),
            'birth-minute',
            !birth.timeUnknown,
          )}
        </View>
      </View>
    </>
  );
}
