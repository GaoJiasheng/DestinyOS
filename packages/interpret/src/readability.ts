import { enWords, zhChars } from '@tianji/content';
import type { GlossaryEntry } from '@tianji/content';
import type { Report } from './types';
import { expandTerms, termCount } from './terms';
export function checkReadability(
  report: Pick<Report, 'system' | 'locale' | 'sections'>,
  glossary: GlossaryEntry[],
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
  const size = report.locale === 'zh' ? chars : words;
  const divination = ['iching', 'qimen', 'tarot'].includes(report.system);
  const minimum = report.locale === 'zh' ? (divination ? 1200 : 2500) : divination ? 900 : 1800;
  const density = (termCount(text, glossary, report.locale) * 100) / (size || 1);
  // Stable issue keys are translated by next-intl at the presentation boundary.
  const issues: string[] = [];
  if (size < minimum) issues.push('report.readability.tooShort');
  if (density > 6) issues.push('report.readability.termDense');
  if (text.includes('{{')) issues.push('report.readability.unresolvedVariables');
  return {
    zhChars: report.locale === 'zh' ? chars : 0,
    enWords: report.locale === 'en' ? words : 0,
    termDensity: density,
    passed: !issues.length,
    issues,
  };
}
