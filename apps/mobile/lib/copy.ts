import { useMemo } from 'react';
import { createTranslator } from 'next-intl';
import { usePreferences } from './preferences';
import { resources, type MobileLocale, type MessageKey } from './i18n';

/** Read exact documented catalog keys through the platform-independent next-intl ICU runtime. */
export function useCopy() {
  const locale = usePreferences((state) => state.locale);
  return useMemo(() => getCopy(locale), [locale]);
}
/** Translate catalog keys outside React for synchronized profile metadata. */
// DESIGN-GAP: Native catalogs are immutable during a session; reuse one next-intl translator per locale to avoid rebuilding it for each list row.
const copyCache = new Map<MobileLocale, ReturnType<typeof createCopy>>();
/** Cache immutable translators so list rows do not rebuild the entire bilingual catalog. */
export function getCopy(locale: MobileLocale) {
  let copy = copyCache.get(locale);
  if (!copy) {
    copy = createCopy(locale);
    copyCache.set(locale, copy);
  }
  return copy;
}
function createCopy(locale: MobileLocale) {
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
}
