import assets from './daily-worker-asset.json';
import type { BirthInput, Locale } from '@tianji/shared';
/** Documented virtual birth used by the unprofiled daily preview, never saved as personal data. */
export const dailyExample: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Example', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};

/** Public example URL: content-versioned engine/corpus, locale, IANA zone and YYYY-MM-DD civil date. */
export function dailyExamplePath(locale: Locale, tz: string, date: string): string {
  // DESIGN-GAP: Reuse the exact worker content hash so a deployment changing rules or knowledge invalidates browser/edge snapshots; timezone slashes remain real asset directories.
  const version = (locale === 'zh-TW' ? assets.traditionalUrl : assets.url)
    .split('/')
    .at(-1)!
    .replace(/\.js$/, '');
  return `/_data/daily-example/${version}/${locale}/${tz.split('/').map(encodeURIComponent).join('/')}/${date}.json`;
}
