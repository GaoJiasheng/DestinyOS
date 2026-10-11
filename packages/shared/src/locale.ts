import uiPairs from './traditional-ui-generated.json' with { type: 'json' };
const ui = new Map<string, string>(uiPairs as [string, string][]);
import chains from './traditional-generated.json' with { type: 'json' };
import { traditionalTerms } from './traditional-terms';
export { traditionalTerms } from './traditional-terms';
import type { Locale } from './enums';

// DESIGN-GAP: Only build-generated vocabulary for published prose is available at runtime; OpenCC stays in the build tools/media service.
const stages = chains.map((entries) => {
  const dictionary = new Map<string, string>(entries as [string, string][]);
  const tokens = [...dictionary.keys()]
    .sort((a, b) => b.length - a.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { dictionary, pattern: tokens.length ? new RegExp(tokens.join('|'), 'gu') : null };
});
const convert = (text: string) =>
  stages.reduce(
    (result, stage) =>
      stage.pattern
        ? result.replace(stage.pattern, (word) => stage.dictionary.get(word) ?? word)
        : result,
    text,
  );
// DESIGN-GAP: Use 裡 consistently; retain 體系 for metaphysical systems and 乾 for the Qian trigram.
const cache = new Map<string, string>();
let cachedChars = 0;
/** Convert reader-facing prose, preserving ICU arguments, term keys and Markdown destinations. */
export function toTraditional(text: string): string {
  const preset = ui.get(text);
  if (preset !== undefined) return preset;
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
