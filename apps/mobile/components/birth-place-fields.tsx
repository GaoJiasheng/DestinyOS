import { useEffect, useMemo, useState } from 'react';
import type { BirthInput, NormalizedBirth } from '@tianji/shared';
import { useCopy } from '../lib/copy';
import { usePreferences } from '../lib/preferences';
import { cityLabel, loadCities, searchCities, type City } from '../lib/cities';
import type { BirthField, FieldIssue } from '../lib/birth-form';
import { Action, CopyText, Field } from './native-ui';
import { FieldErrors, TextEntry } from './birth-inputs';
import { TimezonePicker } from './timezone-picker';
export type Coordinates = { lat: string; lng: string; tz: string };
/** Offline city search (localized names, either Chinese script) with an explicit manual fallback. */
export function BirthPlaceFields({
  birth,
  change,
  manual,
  setManual,
  coordinates,
  setCoordinates,
  issues,
  onBlurField,
  onCityPending,
  preview,
  solar,
}: {
  birth: BirthInput;
  change: (patch: Partial<BirthInput>) => void;
  manual: boolean;
  setManual: (manual: boolean) => void;
  coordinates: Coordinates;
  setCoordinates: (coordinates: Coordinates) => void;
  issues: FieldIssue[];
  onBlurField: (field: BirthField) => void;
  onCityPending: (pending: boolean) => void;
  preview: NormalizedBirth | null;
  solar: boolean;
}) {
  const t = useCopy();
  const locale = usePreferences((s) => s.locale);
  const selected = !manual && birth.place ? birth.place.name : '';
  const [query, setQuery] = useState(selected);
  const [term, setTerm] = useState('');
  const [cities, setCities] = useState<City[] | null>(null);
  const [cityError, setCityError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
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
  }, [attempt]);
  // Searching ~78k cities per keystroke is wasted work while the user is still typing.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query === selected ? '' : query), 150);
    return () => clearTimeout(timer);
  }, [query, selected]);
  const pending = query.trim() !== '' && query !== selected;
  useEffect(() => onCityPending(pending), [pending, onCityPending]);
  const results = useMemo(() => (cities && term ? searchCities(cities, term) : []), [cities, term]);
  const describe = (city: City) => {
    const label = cityLabel(city, locale);
    return [
      label === city.name ? label : `${label} (${city.name})`,
      city.country,
      city.admin,
      city.tz,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  return (
    <>
      <TextEntry
        id="birth-city"
        label={t('form.birth.city')}
        placeholder={t('form.birth.city.placeholder')}
        value={query}
        onChange={setQuery}
        onBlur={() => onBlurField('city')}
        invalid={issues.some((issue) => issue.field === 'city')}
        clearLabel="form.birth.city.clearLabel"
        onClear={() => {
          setQuery('');
          setTerm('');
          if (!manual) change({ place: undefined });
        }}
      >
        <FieldErrors issues={issues} field="city" />
      </TextEntry>
      {/* Shown only while a typed query waits for the list, so a load that finishes before the
          user types (the list is preloaded on step one) never changes the layout under them. */}
      {!cities && !cityError && pending && <CopyText>{t('form.birth.city.loading')}</CopyText>}
      {cityError && (
        <>
          <CopyText>{t('form.birth.city.error')}</CopyText>
          <Action label={t('mobile.profiles.retry')} onPress={() => setAttempt(attempt + 1)} />
        </>
      )}
      {term.trim() && cities && results.length === 0 && (
        <CopyText>{t('form.birth.city.empty')}</CopyText>
      )}
      {results.map((city, index) => (
        <Action
          key={`${city.name}-${city.lat}-${city.lng}`}
          id={`city-result-${index}`}
          label={describe(city)}
          onPress={() => {
            const name = cityLabel(city, locale);
            change({ place: { name, lat: city.lat, lng: city.lng, tz: city.tz } });
            setQuery(name);
            setTerm('');
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
        selected={manual}
        onPress={() => {
          setManual(!manual);
          setQuery('');
          setTerm('');
        }}
      />
      {manual && (
        <>
          {(['lat', 'lng'] as const).map((key) => (
            <Field
              key={key}
              id={`manual-${key}`}
              label={t(`form.birth.${key}`)}
              value={coordinates[key]}
              numeric
              onChange={(value) => setCoordinates({ ...coordinates, [key]: value })}
            />
          ))}
          <TimezonePicker
            id="manual-tz"
            value={coordinates.tz}
            onChange={(tz) => setCoordinates({ ...coordinates, tz })}
            invalid={issues.some((issue) => issue.field === 'tz')}
          />
          <FieldErrors issues={issues} field="tz" />
        </>
      )}
      {preview?.warnings.some((warning) => warning.code === 'W_DST_PERIOD') && (
        <CopyText testID="dst-note">{t('form.birth.dst.note')}</CopyText>
      )}
      {solar &&
        preview?.solarTime.offsetMinutes !== null &&
        preview?.solarTime.offsetMinutes !== undefined && (
          <CopyText>
            {t('form.birth.solarTime.note', {
              minutes: Math.round(preview.solarTime.offsetMinutes),
            })}
          </CopyText>
        )}
    </>
  );
}
