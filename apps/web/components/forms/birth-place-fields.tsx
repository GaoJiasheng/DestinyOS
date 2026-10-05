'use client';
import type { BirthInput, NormalizedBirth } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { CitySearch } from './city-search';
/** Place and timezone controls with the existing explicit manual-coordinate fallback. */
export function BirthPlaceFields({
  birth,
  change,
  manual,
  setManual,
  setPlace,
  setError,
  preview,
  solar,
}: {
  birth: BirthInput;
  change: (patch: Partial<BirthInput>) => void;
  manual: boolean;
  setManual: (value: boolean) => void;
  setPlace: (patch: Partial<NonNullable<BirthInput['place']>>) => void;
  setError: (key: string) => void;
  preview: NormalizedBirth | null;
  solar: boolean;
}) {
  const t = useCopy();
  return (
    <>
      <CitySearch place={birth.place} onSelect={(place) => change({ place })} />
      <p className="muted">{t('form.birth.placeOptional')}</p>
      <details open={manual} onToggle={(e) => setManual(e.currentTarget.open)}>
        <summary>{t('form.birth.manual')}</summary>
        <div className="birth-grid">
          <label className="birth-field">
            {t('form.birth.lat')}
            <input
              type="number"
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
              step="any"
              min={-180}
              max={180}
              value={birth.place?.lng ?? ''}
              onChange={(e) => setPlace({ lng: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="birth-field">
          {t('form.birth.tz')}
          <input
            list="iana-timezones"
            value={birth.place?.tz ?? ''}
            onChange={(e) => setPlace({ tz: e.target.value })}
          />
          <datalist id="iana-timezones">
            {Intl.supportedValuesOf('timeZone').map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void fetch(`/api/v1/geo/tz?lat=${birth.place?.lat ?? ''}&lng=${birth.place?.lng ?? ''}`)
              .then((r) => r.json())
              .then((raw: unknown) => {
                if (
                  raw &&
                  typeof raw === 'object' &&
                  'data' in raw &&
                  raw.data &&
                  typeof raw.data === 'object' &&
                  'tz' in raw.data &&
                  typeof raw.data.tz === 'string'
                )
                  setPlace({ tz: raw.data.tz });
                else setError('engine.errors.E_INVALID_INPUT');
              })
              .catch(() => setError('report.error.E_INTERNAL'));
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
