import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, View, type ScrollView, type TextInput } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput } from '@tianji/shared';
import { useCopy } from '../lib/copy';
import { usePreferences } from '../lib/preferences';
import { anonymousProfileLimit, profileLimitReached, useProfiles } from '../lib/profiles';
import {
  deviceTimeZone,
  emptyBirth,
  lunarMonths,
  monthDays,
  stepOneIssues,
  stepTwoIssues,
  underThirteen,
  validateBirth,
  type BirthField,
} from '../lib/birth-form';
import { birthDoneHref, relationParam, safeReturnTo } from '../lib/birth-route';
import { BirthDateFields } from './birth-date-fields';
import { BirthSchoolFields } from './birth-school-fields';
import { BirthPlaceFields, type Coordinates } from './birth-place-fields';
import { BirthTargetFields, type BirthTarget, type Relation } from './birth-target-fields';
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
/** Native two-step profile editor; calendar, warnings and age validation reuse shared engines.
 * Route params: `id` edits a profile; `returnTo` (in-app path) is where a save lands, with
 * `system` passed back as a query parameter; `relation` presets who the profile is for. */
export function BirthForm() {
  const t = useCopy();
  const locale = usePreferences((s) => s.locale);
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    id?: string;
    returnTo?: string;
    system?: string;
    relation?: string;
  }>();
  const id = params.id;
  const returnTo = safeReturnTo(params.returnTo);
  const { profiles, save, updateSettings } = useProfiles();
  const original = profiles.find((profile) => profile.id === id);
  const [birth, setBirth] = useState<BirthInput>(original?.data?.birth ?? emptyBirth());
  const [year, setYear] = useState(original?.data ? String(original.data.birth.year) : '');
  const [relation, setRelation] = useState<Relation>(() => {
    const preset = original?.data?.relation ?? relationParam(params.relation);
    if (preset) return preset;
    // With a "self" profile already on the device, a new profile is most likely someone else's.
    return profiles.some((p) => (p.data?.relation ?? 'self') === 'self') ? 'partner' : 'self';
  });
  const [target, setTarget] = useState<BirthTarget>(relation === 'self' ? 'self' : 'other');
  const [name, setName] = useState(original?.data?.name ?? '');
  const [school, setSchool] = useState<School>(original?.data?.options?.school ?? defaultSchool);
  const [step, setStep] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [manual, setManual] = useState(false);
  const [precise, setPrecise] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: String(birth.place?.lat ?? ''),
    lng: String(birth.place?.lng ?? ''),
    tz: birth.place?.tz ?? deviceTimeZone(),
  });
  const [attempted, setAttempted] = useState(0);
  const [blurred, setBlurred] = useState<ReadonlySet<BirthField>>(new Set());
  const [cityPending, setCityPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const leaving = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const yearInput = useRef<TextInput>(null);
  const atLimit = !id && profileLimitReached(profiles);
  const touch = () => {
    setDirty(true);
    setError(null);
  };
  const change = (patch: Partial<BirthInput>) => {
    touch();
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
  const preview = useMemo(() => {
    try {
      return normalizeBirth(candidate, locale);
    } catch {
      return null;
    }
  }, [candidate, locale]);
  // Errors appear once a field is left or its step is submitted, never on the first keystroke.
  const stepIssues =
    step === 1 ? stepOneIssues(birth, precise) : stepTwoIssues(candidate, cityPending);
  const issues = stepIssues.filter((issue) => attempted >= step || blurred.has(issue.field));
  const onBlurField = useCallback(
    (field: BirthField) => setBlurred((current) => new Set(current).add(field)),
    [],
  );
  const leave = (href: Href) => {
    leaving.current = true;
    router.replace(href);
  };
  usePreventRemove(!leaving.current && (dirty || step === 2), ({ data }) => {
    if (leaving.current) return navigation.dispatch(data.action);
    // A back swipe or Android back on step two returns to step one instead of dropping both steps.
    if (step === 2) return setStep(1);
    Alert.alert(t('mobile.birth.leaveTitle'), t('mobile.birth.leaveBody'), [
      { text: t('mobile.birth.stay'), style: 'cancel' },
      {
        text: t('mobile.birth.discard'),
        style: 'destructive',
        onPress: () => {
          leaving.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]);
  });
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
  function chooseTarget(next: BirthTarget, nextRelation: Relation) {
    touch();
    setTarget(next);
    setRelation(nextRelation);
  }
  /** Step one: a complete date and hour, then the age check (asked unless it is someone else's). */
  function checkStepOne() {
    const found = stepOneIssues(birth, precise);
    if (found.length) {
      setAttempted((value) => Math.max(value, 1));
      setStep(1);
      scroll.current?.scrollTo({ y: 0, animated: true });
      if (found[0]!.field === 'year') yearInput.current?.focus();
      return false;
    }
    // The place is checked on step two, so a stale zone cannot trap the user on step one.
    const dateOnly = { ...birth, place: undefined };
    const engine = validateBirth(dateOnly, locale);
    if (engine) {
      setError(engine);
      return false;
    }
    // Only a birthday the user says is their own is refused; someone else's chart is always allowed.
    if ((target === 'self' || relation === 'self') && underThirteen(dateOnly, locale)) {
      Alert.alert(t('form.birth.ageCheck.title'), t('form.birth.ageCheck.body'), [
        { text: t('mobile.birth.ageCheck.fix'), style: 'cancel' },
        {
          text: t('mobile.birth.ageCheck.other'),
          onPress: () => {
            // The repository re-checks: a profile saved as someone else keeps a non-self relation.
            touch();
            setTarget('other');
            // A child is far more likely family than a partner; the user can still change it on step one.
            if (relation === 'self') setRelation('family');
            setStep(2);
          },
        },
        {
          text: t('form.birth.ageCheck.self'),
          style: 'destructive',
          onPress: () =>
            void updateSettings({ ageBlocked: true }).finally(() => leave('/age-restricted')),
        },
      ]);
      return false;
    }
    return true;
  }
  function checkStepTwo() {
    const found = stepTwoIssues(candidate, cityPending);
    if (found.length) {
      setAttempted(2);
      if (found.some((issue) => issue.field === 'tz')) setManual(true);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    const engine = validateBirth(candidate, locale);
    if (engine) setError(engine);
    return !engine;
  }
  async function submit() {
    if (step === 1) {
      if (checkStepOne()) setStep(2);
      return;
    }
    if (!checkStepOne() || !checkStepTwo()) return;
    setBusy(true);
    setError(null);
    try {
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
        // Someone else's chart never replaces the profile Today, reminders and widgets follow.
        { activate: target === 'self' },
      );
      leave(birthDoneHref(returnTo, params.system));
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
  const back = () => {
    if (step === 2) return setStep(1);
    if (router.canGoBack()) router.back();
    else router.replace((returnTo ?? '/me') as Href);
  };
  if (atLimit)
    return (
      <Page title="form.birth.title">
        <CopyText testID="profile-limit">
          {t('mobile.profiles.limit', { limit: anonymousProfileLimit })}
        </CopyText>
        <Action id="birth-back" label={t('form.birth.back')} onPress={back} />
      </Page>
    );
  return (
    // DESIGN-GAP: Remount the native scroll view per step so the next heading starts at the top.
    <Page key={step} title="form.birth.title" scrollRef={scroll}>
      {step === 1 && (
        <BirthTargetFields target={target} relation={relation} onChange={chooseTarget} />
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
          precise={precise}
          setPrecise={(value) => {
            touch();
            setPrecise(value);
          }}
          issues={issues}
          onBlurField={onBlurField}
          yearRef={yearInput}
        />
      ) : (
        <>
          <BirthPlaceFields
            birth={birth}
            change={change}
            manual={manual}
            setManual={(value) => {
              touch();
              setManual(value);
            }}
            coordinates={coordinates}
            setCoordinates={(value) => {
              touch();
              setCoordinates(value);
            }}
            issues={issues}
            onBlurField={onBlurField}
            onCityPending={setCityPending}
            preview={preview}
            solar={school.useApparentSolarTime}
          />
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
            onChange={(value) => {
              touch();
              setName(value);
            }}
            maxLength={80}
          />
          <Action
            id="advanced-open"
            label={t('form.birth.advanced')}
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced && (
            <BirthSchoolFields
              school={school}
              setSchool={(value) => {
                touch();
                setSchool(value);
              }}
            />
          )}
        </>
      )}
      {error && <CopyText testID="birth-error">{t(error)}</CopyText>}
      <Action
        id="birth-submit"
        disabled={busy}
        label={t(busy ? 'form.birth.saving' : step === 1 ? 'form.birth.next' : 'form.birth.save')}
        onPress={() => void submit()}
      />
      <Action id="birth-back" disabled={busy} label={t('form.birth.back')} onPress={back} />
    </Page>
  );
}
