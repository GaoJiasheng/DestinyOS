import { enWords, zhChars } from '@tianji/content';
import type { GlossaryEntry } from '@tianji/content';
import type { Report } from './types';
import { expandTerms, createTermCounter } from './terms';
/** Check expanded article length, terminology density and unresolved placeholders.
 * @param report Sections and system/locale used to select the documented minimum length.
 * @param glossary Entries used for marker expansion and terminology counting. */
export function checkReadability(
  report: Pick<Report, 'system' | 'locale' | 'sections'>,
  glossary: GlossaryEntry[],
  countTerms: (text: string) => number = createTermCounter(glossary, report.locale),
): Report['readability'] {
  const text = report.sections
    .flatMap((s) => [
      s.lead,
      ...s.blocks.flatMap((b) => {
        if (b.type === 'paragraph' || b.type === 'transition') return [b.text];
        if (b.type === 'advice') return b.items;
        // References and collapsed classical quotations are not article prose.
        return [];
      }),
    ])
    .join('\n');
  const expanded = expandTerms(text, glossary, report.locale);
  const chars = zhChars(expanded),
    words = enWords(expanded);
  const size = report.locale !== 'en' ? chars : words;
  const divination = ['iching', 'qimen', 'tarot'].includes(report.system);
  const minimum = report.locale !== 'en' ? (divination ? 1200 : 2500) : divination ? 900 : 1800;
  const density = (countTerms(text) * 100) / (size || 1);
  // Stable issue keys are translated by next-intl at the presentation boundary.
  const issues: string[] = [];
  if (size < minimum) issues.push('report.readability.tooShort');
  if (density > 6) issues.push('report.readability.termDense');
  if (text.includes('{{')) issues.push('report.readability.unresolvedVariables');
  return {
    zhChars: report.locale !== 'en' ? chars : 0,
    enWords: report.locale === 'en' ? words : 0,
    termDensity: density,
    passed: !issues.length,
    issues,
  };
}
