import type { Locale } from '@tianji/shared';
/** Fit an authored daily paragraph to the documented 100-character / 70-word reading budget. */
export function dailyExcerpt(
  text: string,
  locale: Locale,
  resolveTerm: (key: string) => string,
): string {
  // DESIGN-GAP: Resolve authored glossary markers through the active next-intl catalog before counting or clipping, so excerpts cannot expose or split internal term IDs.
  const prose = text.replace(/\[\[term:([^\]]+)\]\]/g, (_, key: string) => resolveTerm(key));
  const length = (s: string) =>
    locale !== 'en' ? Array.from(s.replace(/\s/g, '')).length : s.trim().split(/\s+/).length;
  const max = locale !== 'en' ? 100 : 70;
  const sentences = prose.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [prose];
  let result = '';
  for (const sentence of sentences) {
    if (length(result + sentence) > max) break;
    result += sentence;
  }
  // DESIGN-GAP: Prefer complete sentences; a single oversized sentence is clipped at a character/word boundary.
  return (
    result.trim() ||
    (locale !== 'en'
      ? Array.from(prose).slice(0, max).join('')
      : prose.trim().split(/\s+/).slice(0, max).join(' '))
  );
}
