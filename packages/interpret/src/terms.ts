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
    // Existing marks, template placeholders and Markdown links must remain intact.
    // Card-key glossary aliases can also occur in encyclopedia destinations.
    return text
      .split(/(\[\[term:[^\]]+\]\]|\{\{.*?\}\}|\[[^\]\n]+\]\([^()\s]+\))/g)
      .map((part) => {
        if (/^\[\[term:/.test(part)) {
          seen.add(part.slice(7, -2));
          return part;
        }
        if (part.startsWith('{{') || /^\[[^\]\n]+\]\(/.test(part)) return part;
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
  const { regex } = termPattern(glossary, locale);
  return regex ? [...expandTerms(text, glossary, locale).matchAll(regex)].length : 0;
}
