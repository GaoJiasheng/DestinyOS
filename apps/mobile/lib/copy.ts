import { useMemo } from 'react';
import { createTranslator } from 'next-intl';
import { usePreferences } from './preferences';
import { resources, type MessageKey } from './i18n';

/** Read exact documented catalog keys through the platform-independent next-intl ICU runtime. */
export function useCopy() {
  const locale = usePreferences((state) => state.locale);
  return useMemo(() => {
    // DESIGN-GAP: Flatten native runtime names with underscores to preserve source keys that
    // are both a value and namespace (e.g. timeUnknown). The source catalogs remain unchanged.
    const messages = Object.fromEntries(
      Object.entries(resources[locale].translation).map(([key, value]) => [
        key.replaceAll('.', '_'),
        value,
      ]),
    );
    const translate = createTranslator({ locale, messages });
    return (key: MessageKey, values?: Record<string, string | number | Date>) =>
      translate(key.replaceAll('.', '_'), values);
  }, [locale]);
}
