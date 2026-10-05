import { boundAnswer, redactChatText } from './context';
import { chatCopy } from './safety';
import type { MessageKey } from '../../i18n/catalog';
const fieldLabels = new Set([
  'sections',
  'section',
  'summary_actions',
  'answer',
  'advice',
  'dynamics',
  'cards',
  'overview',
  'love',
  'cardKey',
  'day_master',
  'pattern_career',
]);
// DESIGN-GAP: Real MiniMax responses sometimes contain formatting, unfinished sentences or mixed languages. Verify the complete short answer before releasing it; locale failures use a localized retry message instead of silently mistranslating chart claims.
/** Convert short model prose into bounded plain text; return a localized recovery message for invalid language or incomplete output. */
export function finishChatAnswer(
  text: string,
  locale: 'zh' | 'en' | 'zh-TW',
  identities: readonly string[] = [],
): string {
  let plain = redactChatText(text, identities)
    .replace(/^\s*(?:#{1,6}\s+|(?:\d+[.)]|[-*•])\s+)/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*---+\s*$/gm, '')
    // DESIGN-GAP: Map only known report field labels through next-intl; never translate or replace chart claims.
    .replace(
      /\b(?:sections|section|summary_actions|answer|advice|dynamics|cards|overview|love|cardKey|day_master|pattern_career)\b/g,
      (label) =>
        fieldLabels.has(label)
          ? chatCopy(`report.chat.labels.${label}` as MessageKey, locale)
          : label,
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (locale !== 'en') {
    // Restore documented Chinese punctuation after privacy normalization; preserve decimal numbers.
    plain = plain
      .replace(/,\s*/g, '，')
      .replace(/;\s*/g, '；')
      .replace(/:\s*/g, '：')
      .replace(/\?/g, '？')
      .replace(/!/g, '！')
      .replace(/\(/g, '（')
      .replace(/\)/g, '）')
      .replace(/\.(?=\s|$)/g, '。')
      .replace(/"([^"\n]+)"/g, '“$1”');
  }
  if (!plain) throw new Error('Empty chat answer');
  const wrongLanguage =
    locale === 'en'
      ? /\p{Script=Han}/u.test(plain)
      : !/\p{Script=Han}/u.test(plain) || /\b(?:cardKey|day_master|pattern_career)\b/.test(plain);
  if (wrongLanguage) return chatCopy('report.chat.languageFailed', locale);
  const bounded = boundAnswer(plain, locale);
  const endings = [...bounded.matchAll(/[。！？.!?](?:[”"')）]*)/g)];
  const last = endings.at(-1);
  if (!last || last.index === undefined) return chatCopy('report.chat.languageFailed', locale);
  return bounded.slice(0, last.index + last[0].length).trim();
}
