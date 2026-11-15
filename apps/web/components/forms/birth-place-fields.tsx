'use client';
import { useLocale } from 'next-intl';
import { ApiClientError } from '@tianji/api-client';
import { apiClient } from '@/lib/api-client';
import type { BirthInput, NormalizedBirth } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { BirthField, FieldIssue } from '@/lib/birth-form-validate';
import { Button } from '@/components/ui/button';
import { CitySearch } from './city-search';
import { FieldErrors, invalidProps } from './birth-form-parts';
/** Place and timezone controls with the existing explicit manual-coordinate fallback. */
export function BirthPlaceFields({
  birth,
  change,
  manual,
  setManual,
  setError,
  preview,
  solar,
  ids,
  issues,
  onCityPending,
}: {
  birth: BirthInput;
  change: (patch: Partial<BirthInput>) => void;
  manual: boolean;
  setManual: (value: boolean) => void;
  setError: (key: string) => void;
  preview: NormalizedBirth | null;
  solar: boolean;
  ids: Record<BirthField, string>;
  issues: FieldIssue[];
  onCityPending: (pending: boolean) => void;
}) {
  const t = useCopy();
  const locale = useLocale();
  const setPlace = (patch: Partial<NonNullable<BirthInput['place']>>) =>
    change({
      place: {
        name: birth.place?.name ?? t('form.birth.manual'),
        lat: birth.place?.lat ?? 0,
        lng: birth.place?.lng ?? 0,
        tz: birth.place?.tz ?? (locale !== 'en' ? 'Asia/Shanghai' : 'UTC'),
        ...patch,
      },
    });
  const tzIssue = issues.find((i) => i.field === 'tz');
  return (
    <>
      <CitySearch
        id={ids.city}
        place={birth.place}
        onSelect={(place) => change({ place })}
        onClear={() => change({ place: undefined })}
        onPendingChange={onCityPending}
        issue={issues.find((i) => i.field === 'city')}
        manualPlace={manual && !!birth.place}
      />
      <p className="muted">{t('form.birth.placeOptional')}</p>
      <details open={manual || !!tzIssue} onToggle={(e) => setManual(e.currentTarget.open)}>
        <summary>{t('form.birth.manual')}</summary>
        <div className="birth-grid">
          <label className="birth-field">
            {t('form.birth.lat')}
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              aria-label={t('form.birth.lat')}
              step="any"
              min={-90}
              max={90}
              value={birth.place?.lat ?? ''}
              onChange={(e) => setPlace({ lat: Number(e.target.value) })}
            />
          </label>
          <label className="birth-field">
            {t('form.birth.lng')}
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              aria-label={t('form.birth.lng')}
              step="any"
              min={-180}
              max={180}
              value={birth.place?.lng ?? ''}
              onChange={(e) => setPlace({ lng: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="birth-field">
          <label htmlFor={ids.tz}>{t('form.birth.tz')}</label>
          <input
            id={ids.tz}
            list="iana-timezones"
            autoComplete="off"
            enterKeyHint="done"
            aria-label={t('form.birth.tz')}
            value={birth.place?.tz ?? ''}
            onChange={(e) => setPlace({ tz: e.target.value })}
            {...invalidProps(ids.tz, tzIssue)}
          />
          <datalist id="iana-timezones">
            {Intl.supportedValuesOf('timeZone').map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          <FieldErrors issues={tzIssue ? [tzIssue] : []} ids={ids} />
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-label={t('form.birth.resolveTz')}
          onClick={() => {
            void apiClient
              .lookupTimezone({
                lat: String(birth.place?.lat ?? ''),
                lng: String(birth.place?.lng ?? ''),
              })
              .then((data) => setPlace({ tz: data.tz }))
              .catch((error: unknown) =>
                setError(
                  error instanceof ApiClientError && error.kind !== 'decode'
                    ? 'engine.errors.E_INVALID_INPUT'
                    : 'report.error.E_INTERNAL',
                ),
              );
          }}
        >
          {t('form.birth.resolveTz')}
        </Button>
      </details>
      {preview?.warnings.some((w) => w.code === 'W_DST_PERIOD') ? (
        <p className="notice">{t('form.birth.dst.note')}</p>
      ) : null}
      {solar &&
      preview?.solarTime.offsetMinutes !== null &&
      preview?.solarTime.offsetMinutes !== undefined ? (
        <p className="notice">
          {t('form.birth.solarTime.note', {
            minutes: Math.round(preview.solarTime.offsetMinutes),
          })}
        </p>
      ) : null}
    </>
  );
}
