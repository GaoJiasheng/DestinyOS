import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput } from '@tianji/shared';
import { useCopy } from '../lib/copy';
import { usePreferences } from '../lib/preferences';
import { useProfiles } from '../lib/profiles';
import { loadCities, searchCities, type City } from '../lib/cities';
import { lunarMonths, monthDays, validateBirth, underThirteen } from '../lib/birth-form';
import { BirthDateFields } from './birth-date-fields';
import { BirthSchoolFields } from './birth-school-fields';
import { Page, CopyText, Action, Field } from './native-ui';
import type { MessageKey } from '../lib/i18n';
import type { Profile } from '../lib/data/models';

type School = NonNullable<Profile['options']>['school'];
const defaultSchool: School = {
  useApparentSolarTime: true,
  ziHour: 'zi_unified',
  houseSystem: 'placidus',
  leapMonth: 'split_by_15',
};
/** Native two-step profile editor; calendar, warnings and age validation reuse shared engines. */
export function BirthForm() {
  const t = useCopy();
  const locale = usePreferences((s) => s.locale);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profiles, save, updateSettings } = useProfiles();
  const original = profiles.find((profile) => profile.id === id);
  // DESIGN-GAP: Keep the year empty until explicitly entered; date wheels alone do not imply age.
  const [birth, setBirth] = useState<BirthInput>(
    original?.data?.birth ?? {
      calendar: 'gregorian',
      year: 0,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      timeUnknown: false,
      gender: 'unspecified',
    },
  );
  const [year, setYear] = useState(original?.data ? String(original.data.birth.year) : '');
  const [relation, setRelation] = useState<NonNullable<Profile['relation']>>(
    original?.data?.relation ?? 'self',
  );
  const [name, setName] = useState(original?.data?.name ?? '');
  const [school, setSchool] = useState<School>(original?.data?.options?.school ?? defaultSchool);
  const [step, setStep] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [manual, setManual] = useState(false);
  const [coordinates, setCoordinates] = useState({
    lat: String(birth.place?.lat ?? ''),
    lng: String(birth.place?.lng ?? ''),
    tz: birth.place?.tz ?? (locale === 'en' ? 'UTC' : 'Asia/Shanghai'),
  });
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<City[] | null>(null);
  const [cityError, setCityError] = useState(false);
  const [cityAttempt, setCityAttempt] = useState(0);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const change = (patch: Partial<BirthInput>) => {
    setTouched(true);
    setError(null);
    setBirth((current) => ({
      ...current,
      ...patch,
      timeSource: undefined,
      rectificationConfidence: undefined,
    }));
  };
  const candidate = useMemo(
    () =>
      manual
        ? {
            ...birth,
            place: {
              name: t('form.birth.manual'),
              lat: coordinates.lat.trim() ? Number(coordinates.lat) : NaN,
              lng: coordinates.lng.trim() ? Number(coordinates.lng) : NaN,
              tz: coordinates.tz.trim(),
            },
          }
        : birth,
    [birth, manual, coordinates, t],
  );
  const invalid = touched ? validateBirth(candidate, locale) : null;
  const preview = useMemo(() => {
    try {
      return normalizeBirth(candidate, locale);
    } catch {
      return null;
    }
  }, [candidate, locale]);
  const results = useMemo(() => (cities ? searchCities(cities, query) : []), [cities, query]);
  useEffect(() => {
    if (step !== 2) return;
    let active = true;
    setCityError(false);
    void loadCities()
      .then((list) => {
        if (active) setCities(list);
      })
      .catch(() => {
        if (active) setCityError(true);
      });
    return () => {
      active = false;
    };
  }, [step, cityAttempt]);
  function updateDate(patch: Partial<BirthInput>) {
    const next = { ...birth, ...patch };
    if (next.calendar === 'gregorian') next.isLeapMonth = false;
    if (
      next.calendar === 'lunar' &&
      next.isLeapMonth &&
      !lunarMonths(Math.max(1900, Math.min(next.year, 2100))).some(
        (month) => month.month === -next.month,
      )
    )
      next.isLeapMonth = false;
    next.day = Math.min(next.day, monthDays(next));
    change(next);
  }
  async function submit() {
    setTouched(true);
    const validation = validateBirth(candidate, locale);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (underThirteen(candidate, locale)) {
        await updateSettings({ ageBlocked: true });
        router.replace('/age-restricted');
        return;
      }
      if (step === 1) {
        setStep(2);
        return;
      }
      await save(
        {
          name,
          relation,
          isDefault: original?.data?.isDefault ?? false,
          birth: BirthInputSchema.parse(candidate),
          options: { school },
          version: original?.data?.version ?? 1,
          isCurrent: true,
        },
        id,
      );
      router.replace({ pathname: '/me', params: { saved: '1' } });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'E_PROFILE_LIMIT'
          ? 'report.error.E_PROFILE_LIMIT'
          : 'mobile.storage.error',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    // DESIGN-GAP: Remount the native scroll view per step so the next heading starts at the top.
    <Page key={step} title="form.birth.title">
      {step === 1 && (
        <>
          <CopyText>{t('profiles.relation')}</CopyText>
          {(['self', 'partner', 'family', 'friend', 'other'] as const).map((item) => (
            <Action
              key={item}
              id={`profile-relation-${item}`}
              label={t(`profiles.relation.${item}`)}
              selected={relation === item}
              onPress={() => setRelation(item)}
            />
          ))}
        </>
      )}
      <CopyText>{t('form.birth.step', { step })}</CopyText>
      <CopyText title>{t(step === 1 ? 'form.birth.dateTime' : 'form.birth.placeGender')}</CopyText>
      {step === 1 ? (
        <BirthDateFields
          birth={birth}
          year={year}
          setYear={setYear}
          change={change}
          updateDate={updateDate}
        />
      ) : (
        <>
          <Field
            id="birth-city"
            label={t('form.birth.city')}
            placeholder={t('form.birth.city.placeholder')}
            value={query}
            onChange={setQuery}
          />
          {!cities && !cityError && <CopyText>{t('form.birth.city.loading')}</CopyText>}
          {cityError && (
            <>
              <CopyText>{t('form.birth.city.error')}</CopyText>
              <Action
                label={t('mobile.profiles.retry')}
                onPress={() => setCityAttempt(cityAttempt + 1)}
              />
            </>
          )}
          {query.trim() && cities && results.length === 0 && (
            <CopyText>{t('form.birth.city.empty')}</CopyText>
          )}
          {results.map((city, index) => (
            <Action
              key={`${city.name}-${city.lat}-${city.lng}`}
              id={`city-result-${index}`}
              label={`${city.name} · ${city.country} · ${city.admin} · ${city.tz}`}
              onPress={() => {
                change({ place: { name: city.name, lat: city.lat, lng: city.lng, tz: city.tz } });
                setQuery('');
                setManual(false);
              }}
            />
          ))}
          {birth.place && !manual && (
            <CopyText testID="selected-city">
              {birth.place.name} · {birth.place.tz}
            </CopyText>
          )}
          <CopyText>{t('mobile.city.attribution')}</CopyText>
          <CopyText>{t('form.birth.placeOptional')}</CopyText>
          <Action
            id="manual-open"
            label={t('form.birth.manual')}
            onPress={() => {
              setManual(!manual);
              setTouched(true);
            }}
          />
          {manual &&
            (['lat', 'lng', 'tz'] as const).map((key) => (
              <Field
                key={key}
                id={`manual-${key}`}
                label={t(`form.birth.${key}`)}
                value={coordinates[key]}
                numeric={key !== 'tz'}
                onChange={(value) => {
                  setCoordinates({ ...coordinates, [key]: value });
                  setTouched(true);
                }}
              />
            ))}
          {preview?.warnings.some((warning) => warning.code === 'W_DST_PERIOD') && (
            <CopyText testID="dst-note">{t('form.birth.dst.note')}</CopyText>
          )}
          {school.useApparentSolarTime &&
            preview?.solarTime.offsetMinutes !== null &&
            preview?.solarTime.offsetMinutes !== undefined && (
              <CopyText>
                {t('form.birth.solarTime.note', {
                  minutes: Math.round(preview.solarTime.offsetMinutes),
                })}
              </CopyText>
            )}
          <CopyText>{t('form.birth.gender')}</CopyText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['male', 'female', 'unspecified'] as const).map((gender) => (
              <Action
                key={gender}
                id={`gender-${gender}`}
                selected={birth.gender === gender}
                label={t(`form.birth.gender.${gender}`)}
                onPress={() => change({ gender })}
              />
            ))}
          </View>
          {birth.gender === 'unspecified' && (
            <CopyText>{t('form.birth.gender.unspecified.note')}</CopyText>
          )}
          <Field
            id="birth-name"
            label={t('form.birth.displayName')}
            value={name}
            onChange={setName}
            maxLength={80}
          />
          <Action
            id="advanced-open"
            label={t('form.birth.advanced')}
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced && <BirthSchoolFields school={school} setSchool={setSchool} />}
        </>
      )}
      {(error || invalid) && <CopyText testID="birth-error">{t((error || invalid)!)}</CopyText>}
      <Action
        id="birth-submit"
        disabled={busy}
        label={t(busy ? 'form.birth.saving' : step === 1 ? 'form.birth.next' : 'form.birth.save')}
        onPress={() => void submit()}
      />
      <Action
        id="birth-back"
        disabled={busy}
        label={t('form.birth.back')}
        onPress={() => {
          if (step === 2) setStep(1);
          else router.replace('/me');
        }}
      />
    </Page>
  );
}
