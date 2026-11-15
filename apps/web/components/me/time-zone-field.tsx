'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
/** Searchable IANA zone picker with an automatic option; browsers without the zone list keep free text entry. */
export function TimeZoneField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (zone: string | null) => void;
}) {
  const t = useCopy(),
    id = useId();
  // Resolved after mount so server HTML (UTC, full list) cannot mismatch the visitor's browser.
  const [zones, setZones] = useState<string[] | null>(null),
    [detected, setDetected] = useState(''),
    [query, setQuery] = useState('');
  useEffect(() => {
    setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setZones(
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [],
    );
  }, []);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
    const list = (zones ?? []).filter((zone) => !needle || zone.toLowerCase().includes(needle));
    // Keep the saved zone selectable even when the search hides it.
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [zones, query, value]);
  if (zones && !zones.length)
    return (
      <>
        <label>
          {t('me.tz')}
          <input
            value={value ?? ''}
            placeholder={detected}
            onChange={(e) => onChange(e.target.value.trim() || null)}
          />
        </label>
        <p className="muted">{t('me.tzHelp')}</p>
      </>
    );
  return (
    <div className="settings-tz">
      <label htmlFor={`${id}-zone`}>{t('me.tz')}</label>
      <input
        type="search"
        aria-label={t('me.tzSearch')}
        placeholder={t('me.tzSearch')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        id={`${id}-zone`}
        aria-describedby={`${id}-help`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t('me.tzAuto', { zone: detected || '—' })}</option>
        {matches.map((zone) => (
          <option value={zone} key={zone}>
            {zone.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <p id={`${id}-help`} className="muted">
        {query && !matches.length ? t('me.tzNoMatch') : t('me.tzPickHelp')}
      </p>
    </div>
  );
}
