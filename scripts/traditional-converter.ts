import { Converter } from 'opencc-js/cn2t';
import type { Locale } from '../packages/shared/src/enums';

// B-09: cn → twp is OpenCC's s2twp pipeline (Taiwan phrases included).
const convert = Converter({ from: 'cn', to: 'twp' });
// DESIGN-GAP: Use 裡 consistently; retain 體系 for metaphysical systems and 乾 for the Qian trigram.
import { traditionalTerms } from '../packages/shared/src/traditional-terms';
const cache = new Map<string, string>();
let cachedChars = 0;
/** Convert reader-facing prose, preserving ICU arguments, term keys and Markdown destinations. */
export function toTraditional(text: string): string {
  const found = cache.get(text);
  if (found !== undefined) {
    cache.delete(text);
    cache.set(text, found);
    return found;
  }
  const tokens =
    /(\[\[term:[^\]]+\]\]|\{\{?[\w.]+(?:,\s*(?:number|date|time)(?:,[^{}]*)?)?\}\}?|\]\([^()\s]+\)|https?:\/\/[^\s)]+)/g;
  const protectedToken = new RegExp(`^${tokens.source}$`);
  const result = text
    .split(tokens)
    .map((part) =>
      protectedToken.test(part)
        ? part
        : traditionalTerms.reduce((value, [from, to]) => value.replaceAll(from, to), convert(part)),
    )
    .join('');
  // DESIGN-GAP: A browser-safe LRU is bounded by both 2,048 entries and one million source characters; only converted strings are retained.
  if (text.length <= 100_000) {
    cache.set(text, result);
    cachedChars += text.length;
    while (cache.size > 2048 || cachedChars > 1_000_000) {
      const oldest = cache.keys().next().value as string;
      cachedChars -= oldest.length;
      cache.delete(oldest);
    }
  }
  return result;
}
/** Select the editorial KU source without duplicating traditional knowledge units. */
export function sourceLocale(locale: Locale): 'zh' | 'en' {
  return locale === 'en' ? 'en' : 'zh';
}
/** Localize generated prose at a presentation boundary. */
export function localeText(text: string, locale: Locale): string {
  return locale === 'zh-TW' ? toTraditional(text) : text;
}
