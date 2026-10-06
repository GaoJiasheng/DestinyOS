import { useCopy } from '../lib/copy';
import type { MessageKey } from '../lib/i18n';
import type { Profile } from '../lib/data/models';
import { useNativePickers } from './native-pickers';
import { CopyText } from './native-ui';
type School = NonNullable<Profile['options']>['school'];
/** Persist documented school values in the profile, without unsupported Koch selection. */
export function BirthSchoolFields({
  school,
  setSchool,
}: {
  school: School;
  setSchool: (school: School) => void;
}) {
  const t = useCopy();
  const { wheel, toggle } = useNativePickers();
  return (
    <>
      {toggle(
        t('form.birth.apparentSolarTime'),
        school.useApparentSolarTime,
        (value) => setSchool({ ...school, useApparentSolarTime: value }),
        'solar-time',
      )}
      {wheel(
        t('form.birth.ziHour'),
        school.ziHour,
        (value) => setSchool({ ...school, ziHour: value as School['ziHour'] }),
        ['zi_unified', 'zi_split'].map((value) => ({
          value,
          label: t(`form.birth.${value}` as MessageKey),
        })),
        'school-zi',
      )}
      {wheel(
        t('form.birth.houseSystem'),
        school.houseSystem,
        (value) => setSchool({ ...school, houseSystem: value as School['houseSystem'] }),
        ['placidus', 'whole_sign', 'equal'].map((value) => ({
          value,
          label: t(`form.birth.house.${value}` as MessageKey),
        })),
        'school-house',
      )}
      {wheel(
        t('form.birth.leapRule'),
        school.leapMonth,
        (value) => setSchool({ ...school, leapMonth: value as School['leapMonth'] }),
        [
          { value: 'split_by_15', label: t('form.birth.leap.split') },
          { value: 'as_prev', label: t('form.birth.leap.current') },
          { value: 'as_next', label: t('form.birth.leap.next') },
        ],
        'school-leap',
      )}
      <CopyText>{t('mobile.profiles.options')}</CopyText>
    </>
  );
}
