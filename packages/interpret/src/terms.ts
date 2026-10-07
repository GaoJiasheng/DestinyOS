import { localeText } from '@tianji/shared/locale';
import type { GlossaryEntry } from '@tianji/content';
import type { Locale } from '@tianji/shared';
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Factor shared prefixes without changing longest-match priority or literal spelling. */
function alternatives(terms: string[]): string {
  type Node = { terminal: boolean; children: Map<string, Node> };
  const root: Node = { terminal: false, children: new Map() };
  for (const term of terms) {
    let node = root;
    for (let character of term) {
      // Preserve RegExp's simple Unicode case folding when equivalent prefixes
      // have different lowercase forms (e.g. Greek final sigma), without full folds.
      const folded = character.toUpperCase().toLowerCase();
      if (
        folded !== character &&
        [...folded].length === 1 &&
        new RegExp(`^${escape(character)}$`, 'iu').test(folded)
      )
        character = folded;
      let child = node.children.get(character);
      if (!child) {
        child = { terminal: false, children: new Map() };
        node.children.set(character, child);
      }
      node = child;
    }
    node.terminal = true;
  }
  const compile = (node: Node): string => {
    const choices = [...node.children].map(
      ([character, child]) => escape(character) + compile(child),
    );
    if (node.terminal) choices.push('');
    return choices.length > 1 ? `(?:${choices.join('|')})` : (choices[0] ?? '');
  };
  return compile(root);
}
// DESIGN-GAP: Single Han characters match only standalone tokens to avoid marking 己 in 自己 or 子 in 例子.
/** Longest terms win; English boundaries prevent Wood matching Hollywood. */
export function termPattern(glossary: GlossaryEntry[], locale: Locale) {
  const terms = glossary.flatMap((entry) =>
    [
      localeText(entry[locale === 'en' ? 'en' : 'zh'].term, locale),
      ...entry.aliases.filter((alias) =>
        locale !== 'en' ? /\p{Script=Han}/u.test(alias) : !/\p{Script=Han}/u.test(alias),
      ),
    ]
      // DESIGN-GAP: The branch transliteration "You" is also an English pronoun; require an explicit marker rather than automatically linking ordinary prose.
      .filter((term) => !(locale === 'en' && entry.key === 'branch.you' && /^you$/i.test(term)))
      .map((term) => ({ term: localeText(term, locale), key: entry.key })),
  );
  terms.sort((a, b) => b.term.length - a.term.length || (a.key < b.key ? -1 : 1));
  const unique = new Map<string, string>();
  const ambiguous = new Set<string>();
  // DESIGN-GAP: Shared spellings such as Yin (polarity/branch) and Wu (stem/branch) need explicit references instead of an arbitrary alphabetic winner.
  for (const entry of terms) {
    const spelling = entry.term.toLowerCase();
    if (ambiguous.has(spelling)) continue;
    const previous = unique.get(spelling);
    if (previous && previous !== entry.key) {
      unique.delete(spelling);
      ambiguous.add(spelling);
    } else unique.set(spelling, entry.key);
  }
  const spellings = [...unique.keys()];
  const standalone = locale === 'en' ? [] : spellings.filter((term) => [...term].length === 1);
  // DESIGN-GAP: Share identical Chinese single-character boundaries, preserving longest
  // matches while avoiding repeated Unicode lookbehind at every character on Hermes.
  const pattern = [
    // DESIGN-GAP: Hermes pays the flat glossary's repeated-prefix cost on the first
    // Chinese report; a literal prefix trie keeps the same longest-first matches.
    alternatives(spellings.filter((term) => locale === 'en' || [...term].length !== 1)),
    standalone.length
      ? `(?<![\\p{Script=Han}])(?:${standalone.map(escape).join('|')})(?![\\p{Script=Han}])`
      : '',
  ]
    .filter(Boolean)
    .join('|');
  // DESIGN-GAP: English hexagram names are proper titles; lowercase prose such as approach, progress or waiting is not a reference to another hexagram.
  const exactNames = new Map(
    glossary
      .filter((entry) => locale === 'en' && /^hexagram\.\d+$/.test(entry.key))
      .map((entry) => [entry.key, new Set([entry.en.term, ...entry.aliases])]),
  );
  const isTechnicalMatch = (matched: string, key: string) =>
    !exactNames.has(key) || exactNames.get(key)!.has(matched);
  // DESIGN-GAP: Factor the identical English Unicode boundaries outside the alternatives; Hermes otherwise repeats expensive lookbehind for every glossary term at every character.
  const bounded =
    locale === 'en' ? `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])` : pattern;
  return { regex: pattern ? new RegExp(bounded, 'giu') : null, unique, isTechnicalMatch };
}
/** Create a report-scoped annotator marking only the first unambiguous term occurrence.
 * @param glossary Fixed glossary entries for one report.
 * @param locale Matching language; Chinese variants use localized terms. */
export function termMarker(
  glossary: GlossaryEntry[],
  locale: Locale,
  matcher = termPattern(glossary, locale),
) {
  const { regex, unique, isTechnicalMatch } = matcher;
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
          if (!key || seen.has(key) || !isTechnicalMatch(matched, key)) return matched;
          seen.add(key);
          return `[[term:${key}]]`;
        });
      })
      .join('');
  };
}
/** Expand explicit term markers to localized display terms, retaining unknown markers.
 * @param text Prose containing [[term:key]] markers.
 * @param glossary Known term definitions.
 * @param locale Target display language. */
export function expandTerms(text: string, glossary: GlossaryEntry[], locale: Locale): string {
  return text.replace(/\[\[term:([^\]]+)\]\]/g, (mark: string, key: string) =>
    localeText(
      glossary.find((g) => g.key === key)?.[locale === 'en' ? 'en' : 'zh'].term ?? mark,
      locale,
    ),
  );
}
/** Count automatic and explicit terminology references using the report matching rules.
 * @param text Report prose or marked text.
 * @param glossary Known term definitions.
 * @param locale Matching language. */
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
  matcher = termPattern(glossary, locale),
): (text: string) => number {
  const { regex, unique, isTechnicalMatch } = matcher;
  const explicitOnly = new Set(
    glossary
      .filter(
        (entry) =>
          unique.get(
            localeText(entry[locale === 'en' ? 'en' : 'zh'].term, locale).toLowerCase(),
          ) !== entry.key,
      )
      .map((entry) => entry.key),
  );
  return (text) => {
    const automatic = regex
      ? [...expandTerms(text, glossary, locale).matchAll(regex)].filter((match) => {
          const key = unique.get(match[0].toLowerCase());
          return key && isTechnicalMatch(match[0], key);
        }).length
      : 0;
    // Explicit references to ambiguous names still count once as technical terms.
    const explicit = [...text.matchAll(/\[\[term:([^\]]+)\]\]/g)].filter((match) =>
      explicitOnly.has(match[1]!),
    ).length;
    return automatic + explicit;
  };
}
