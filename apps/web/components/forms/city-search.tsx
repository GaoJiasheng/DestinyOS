'use client';
import { useEffect, useId, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import type { BirthInput, City } from '@tianji/shared';
import { apiClient } from '@/lib/api-client';
/** Accessible city autocomplete; aborted requests cannot replace a newer query's matches. */
export function CitySearch({
  place,
  onSelect,
}: {
  place?: BirthInput['place'];
  onSelect: (place: NonNullable<BirthInput['place']>) => void;
}) {
  const t = useCopy();
  const locale = useLocale();
  const id = useId();
  const [query, setQuery] = useState(place?.name ?? '');
  const [results, setResults] = useState<City[]>([]);
  const [state, setState] = useState('idle');
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (query.trim().length < 1 || query === place?.name) {
      setResults([]);
      setState('idle');
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setState('loading');
      void apiClient
        .searchCities(
          { q: query, locale: locale as 'zh' | 'en' | 'zh-TW' },
          { signal: abort.signal },
        )
        .then((data) => {
          setResults(data);
          setActive(0);
          setState(data.length ? 'ready' : 'empty');
        })
        .catch(() => {
          if (!abort.signal.aborted) setState('error');
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, locale, place?.name]);
  const select = (c: City) => {
    onSelect({ name: c.name, lat: c.lat, lng: c.lng, tz: c.tz });
    setQuery(c.name);
    setResults([]);
  };
  return (
    <div className="birth-field">
      <label htmlFor={id}>{t('form.birth.city')}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-results`}
        aria-activedescendant={results.length ? `${id}-${active}` : undefined}
        value={query}
        placeholder={t('form.birth.city.placeholder')}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((n) => Math.min(results.length - 1, n + 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((n) => Math.max(0, n - 1));
          }
          if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            select(results[active]!);
          }
          if (e.key === 'Escape') setResults([]);
        }}
      />
      <ul id={`${id}-results`} role="listbox" className="city-results">
        {results.map((c, i) => (
          <li
            key={`${c.name}-${c.lat}`}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === active}
          >
            <button type="button" tabIndex={-1} onClick={() => select(c)}>
              {c.name}
              <span className="muted">
                {c.country} · {c.admin} · {c.tz}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="muted">
        {state === 'loading'
          ? t('form.birth.city.loading')
          : state === 'empty'
            ? t('form.birth.city.empty')
            : state === 'error'
              ? t('form.birth.city.error')
              : place
                ? `${place.name} · ${place.tz}`
                : ''}
      </p>
    </div>
  );
}
