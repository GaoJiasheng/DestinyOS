import type { Locale } from '@tianji/shared';
/** Fit an authored daily paragraph to the documented 100-character / 70-word reading budget. */
export function dailyExcerpt(text: string, locale: Locale): string {
  const length = (s: string) =>
    locale !== 'en' ? Array.from(s.replace(/\s/g, '')).length : s.trim().split(/\s+/).length;
  const max = locale !== 'en' ? 100 : 70;
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [text];
  let result = '';
  for (const sentence of sentences) {
    if (length(result + sentence) > max) break;
    result += sentence;
  }
  // DESIGN-GAP: Prefer complete sentences; a single oversized sentence is clipped at a character/word boundary.
  return (
    result.trim() ||
    (locale !== 'en'
      ? Array.from(text).slice(0, max).join('')
      : text.trim().split(/\s+/).slice(0, max).join(' '))
  );
}
