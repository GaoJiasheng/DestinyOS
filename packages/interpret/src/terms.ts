import type { GlossaryEntry } from '@tianji/content';
import type { Locale } from '@tianji/shared';
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// DESIGN-GAP: Single Han characters match only standalone tokens to avoid marking 己 in 自己 or 子 in 例子.
/** Longest terms win; English boundaries prevent Wood matching Hollywood. */
export function termPattern(glossary: GlossaryEntry[], locale: Locale) {
  const terms = glossary.flatMap((entry) =>
    [
      entry[locale].term,
      ...entry.aliases.filter((alias) =>
        locale === 'zh' ? /\p{Script=Han}/u.test(alias) : !/\p{Script=Han}/u.test(alias),
      ),
    ].map((term) => ({ term, key: entry.key })),
  );
  terms.sort((a, b) => b.term.length - a.term.length || (a.key < b.key ? -1 : 1));
  const unique = new Map<string, string>();
  for (const entry of terms)
    if (!unique.has(entry.term.toLowerCase())) unique.set(entry.term.toLowerCase(), entry.key);
  const pattern = [...unique.keys()]
    .map((term) =>
      locale === 'en'
        ? `(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`
        : [...term].length === 1
          ? `(?<![\\p{Script=Han}])${escape(term)}(?![\\p{Script=Han}])`
          : escape(term),
    )
    .join('|');
  return { regex: pattern ? new RegExp(pattern, 'giu') : null, unique };
}
export function termMarker(glossary: GlossaryEntry[], locale: Locale) {
  const { regex, unique } = termPattern(glossary, locale);
  const seen = new Set<string>();
  return (text: string): string => {
    if (!regex) return text;
    // Existing marks and template placeholders must not be marked recursively.
    return text
      .split(/(\[\[term:[^\]]+\]\]|\{\{.*?\}\})/g)
      .map((part) => {
        if (/^\[\[term:/.test(part)) {
          seen.add(part.slice(7, -2));
          return part;
        }
        if (part.startsWith('{{')) return part;
        return part.replace(regex, (matched) => {
          const key = unique.get(matched.toLowerCase());
          if (!key || seen.has(key)) return matched;
          seen.add(key);
          return `[[term:${key}]]`;
        });
      })
      .join('');
  };
}
export function expandTerms(text: string, glossary: GlossaryEntry[], locale: Locale): string {
  return text.replace(
    /\[\[term:([^\]]+)\]\]/g,
    (mark: string, key: string) => glossary.find((g) => g.key === key)?.[locale].term ?? mark,
  );
}
export function termCount(text: string, glossary: GlossaryEntry[], locale: Locale): number {
  return createTermCounter(glossary, locale)(text);
}

/**
 * Compile one matcher for repeated texts within a report, with unchanged term boundaries.
 * @param glossary Fixed glossary entries for this report; recreate the matcher if terms change.
 * @param locale Matching language, zh or en.
 * @returns A counter of glossary term occurrences in each supplied text.
 */
export function createTermCounter(
  glossary: GlossaryEntry[],
  locale: Locale,
): (text: string) => number {
  const { regex } = termPattern(glossary, locale);
  return (text) => (regex ? [...expandTerms(text, glossary, locale).matchAll(regex)].length : 0);
}
