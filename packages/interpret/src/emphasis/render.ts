import type { Dim, ScoringLevelKey, ScoringLocaleCopy } from '@tianji/content';
import { ziweiScoringCopy } from '@tianji/content/scoring/ziwei-copy';
import type { Locale } from '@tianji/shared';
import type { Emphasis, EmphasisBasis, EmphasisLevel } from './types';
// Browser entry: only the compiled emphasis copy (all three locales, pre-converted) is bundled here,
// never the knowledge base or the runtime traditional-Chinese converter.
const copyFor = (locale: Locale): ScoringLocaleCopy => ziweiScoringCopy.locales[locale];
function list(items: string[], locale: Locale): string {
  if (locale !== 'en') return items.join('、');
  if (items.length < 3) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
const keys = (value: string | undefined) => (value ? value.split(',') : []);
/** Render one basis entry as a sentence; negative entries end with their advice.
 * Unknown rule ids (e.g. a newer report on an older client) render as an empty string.
 * @param basis Stored rule hit with stable chart keys.
 * @param locale Reader locale; zh-TW uses copy generated from zh by the OpenCC build step. */
export function renderEmphasisBasis(basis: EmphasisBasis, locale: Locale): string {
  const copy = copyFor(locale);
  const rule = copy.rules[basis.ruleId];
  if (!rule) return '';
  const variant = basis.delta > 0 ? rule.positive : basis.delta < 0 ? rule.negative : rule.zero;
  if (!variant) return '';
  const term = (key: string) => copy.terms[key] ?? key.slice(key.indexOf('.') + 1);
  const { params } = basis;
  const stars = keys(params.stars);
  const brightness = keys(params.brightness);
  const values: Record<string, string> = {
    palace: term(`palace.${params.palace}`),
    opposite: term(`palace.${params.opposite}`),
    star: term(`star.${params.star}`),
    mutagen: term(`mutagen.${params.mutagen}`),
    stars: list(
      stars.map((s) => term(`star.${s}`)),
      locale,
    ),
    starsBrightness: list(
      stars.map((s, n) => {
        const level = term(`brightness.${brightness[n]}`);
        return locale === 'en'
          ? `${term(`star.${s}`)} at ${level}`
          : `${term(`star.${s}`)}（${level}）`;
      }),
      locale,
    ),
  };
  const text = variant.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
  if (basis.delta >= 0 || !rule.advice) return text;
  return locale === 'en' ? `${text} ${rule.advice}` : `${text}${rule.advice}`;
}
/** Level word for a band: Standout / Supported / Steady / Takes more care. */
export function emphasisLevelLabel(level: EmphasisLevel, locale: Locale): string {
  return copyFor(locale).levels[String(level) as ScoringLevelKey];
}
/** Axis label for a dimension (e.g. 事业 / Career). */
export function emphasisDimLabel(dim: Dim, locale: Locale): string {
  return copyFor(locale).dims[dim]?.label ?? dim;
}
/** One-sentence reading of a dimension at its band. */
export function emphasisDimSentence(dim: Dim, level: EmphasisLevel, locale: Locale): string {
  return copyFor(locale).sentences[dim]?.[String(level) as ScoringLevelKey] ?? '';
}
/** Overview sentence naming the top dimensions; `limit: 1` names only the strongest (share cards, Q4). */
export function emphasisOverview(
  emphasis: Pick<Emphasis, 'top'>,
  locale: Locale,
  limit: 1 | 2 = 2,
): string {
  const copy = copyFor(locale);
  const [first, second] = emphasis.top.slice(0, limit).map((dim) => copy.dims[dim]?.inline ?? dim);
  if (!first) return copy.overview.none;
  const template = second ? copy.overview.two : copy.overview.one;
  return template.replace('{first}', first).replace('{second}', second ?? '');
}
/** Module title (命盘侧重 / Chart emphasis). */
export function emphasisTitle(locale: Locale): string {
  return copyFor(locale).title;
}
/** Fixed footnotes: disclaimer, health omission, cross-system note and brightness-table note. */
export function emphasisFootnotes(locale: Locale): ScoringLocaleCopy['footnotes'] {
  return copyFor(locale).footnotes;
}
