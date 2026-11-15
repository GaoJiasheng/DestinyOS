'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import type { BirthInput, City } from '@tianji/shared';
import type { FieldIssue } from '@/lib/birth-form-validate';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { errorId } from './birth-form-parts';
/** Accessible city autocomplete; aborted requests cannot replace a newer query's matches.
 * Typed text only takes effect once a suggestion is chosen, and the parent is told while text is unconfirmed. */
export function CitySearch({
  id,
  place,
  onSelect,
  onClear,
  onPendingChange,
  issue,
  manualPlace = false,
}: {
  id: string;
  place?: BirthInput['place'];
  onSelect: (place: NonNullable<BirthInput['place']>) => void;
  onClear: () => void;
  onPendingChange: (pending: boolean) => void;
  issue?: FieldIssue;
  /** Coordinates typed in the manual section stand in for a chosen suggestion. */
  manualPlace?: boolean;
}) {
  const t = useCopy();
  const locale = useLocale();
  const [query, setQuery] = useState(place?.name ?? '');
  const [results, setResults] = useState<City[]>([]);
  const [state, setState] = useState('idle');
  const [active, setActive] = useState(0);
  const [blurred, setBlurred] = useState(false);
  const pending = query.trim().length > 0 && query !== place?.name && !manualPlace;
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);
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
    setBlurred(false);
  };
  const status =
    state === 'loading'
      ? t('form.birth.city.loading')
      : state === 'empty'
        ? t('form.birth.city.empty')
        : state === 'error'
          ? t('form.birth.city.error')
          : !pending && place
            ? `${place.name} · ${place.tz}`
            : '';
  // Unconfirmed text is flagged after leaving the field or on submit; while typing, the live search status is enough.
  const showHint = pending && state !== 'loading' && state !== 'error' && (blurred || !!issue);
  return (
    <div className="birth-field">
      <label htmlFor={id}>{t('form.birth.city')}</label>
      <div className="city-input-row">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={`${id}-results`}
          aria-activedescendant={results.length ? `${id}-${active}` : undefined}
          aria-invalid={showHint || undefined}
          aria-describedby={showHint ? errorId(id) : undefined}
          value={query}
          placeholder={t('form.birth.city.placeholder')}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setBlurred(false);
          }}
          onBlur={() => setBlurred(true)}
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
            } else if (e.key === 'Enter' && pending) {
              // Suggestions may still be loading; Enter must not submit text that was never chosen.
              e.preventDefault();
              setBlurred(true);
            }
            if (e.key === 'Escape') setResults([]);
          }}
        />
        {place || query ? (
          <Button
            type="button"
            variant="secondary"
            aria-label={t('form.birth.city.clearLabel')}
            onClick={() => {
              setQuery('');
              setResults([]);
              setBlurred(false);
              if (place) onClear();
              document.getElementById(id)?.focus();
            }}
          >
            {t('form.birth.city.clear')}
          </Button>
        ) : null}
      </div>
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
      {showHint ? (
        <p id={errorId(id)} className="form-error field-error">
          {t('form.birth.city.unselected')}
        </p>
      ) : null}
      <p role="status" className="muted">
        {status}
      </p>
    </div>
  );
}
