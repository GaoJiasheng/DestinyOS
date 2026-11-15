import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useCopy } from '../lib/copy';
import { deviceTimeZone } from '../lib/birth-form';
import { searchTimeZones } from '../lib/timezones';
import { Action, CopyText } from './native-ui';
import { TextEntry } from './birth-inputs';
/** Searchable IANA time-zone chooser; the value only changes when a listed zone is picked. */
export function TimezonePicker({
  value,
  onChange,
  id = 'timezone',
  label,
  invalid = false,
  errorHint,
}: {
  value: string;
  onChange: (zone: string) => void;
  id?: string;
  label?: string;
  invalid?: boolean;
  errorHint?: string;
}) {
  const t = useCopy();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTimeZones(query), [query]);
  const device = useMemo(() => deviceTimeZone(), []);
  return (
    <View style={{ gap: 8 }}>
      <TextEntry
        id={id}
        label={label ?? t('form.birth.tz')}
        value={query}
        onChange={setQuery}
        placeholder={t('mobile.tz.search')}
        invalid={invalid}
        errorHint={errorHint}
        clearLabel="mobile.tz.clearSearch"
        onClear={() => setQuery('')}
      />
      <CopyText testID={`${id}-current`}>
        {value ? t('mobile.tz.current', { zone: value }) : t('mobile.tz.none')}
      </CopyText>
      {query.trim() && results.length === 0 && <CopyText>{t('mobile.tz.empty')}</CopyText>}
      {results.map((zone, index) => (
        <Action
          key={zone}
          id={`${id}-result-${index}`}
          label={zone}
          selected={zone === value}
          onPress={() => {
            onChange(zone);
            setQuery('');
          }}
        />
      ))}
      {value !== device && !query.trim() && (
        <Action
          id={`${id}-device`}
          label={t('mobile.tz.device', { zone: device })}
          onPress={() => onChange(device)}
        />
      )}
    </View>
  );
}
