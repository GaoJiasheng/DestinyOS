import { resourceText } from '../platform/resources';
import type { System } from '@tianji/shared';
import { ReportSchema } from '../reading-schema';
import type { LlmMessage } from './minimax';
import { selectChatSections, excerptChatText } from './selection';

// DESIGN-GAP: Existing chart stripping retains reversible clocks; the LLM uses an independent derived-element allowlist.
const roots: Record<System, readonly string[]> = {
  bazi: [
    'pillars',
    'dayMaster',
    'elements',
    'strength',
    'useGod',
    'pattern',
    'relations',
    'voidBranches',
    'shenSha',
    'features',
  ],
  ziwei: ['basics', 'palaces', 'patterns', 'emptyPalaces'],
  iching: [
    'method',
    'category',
    'primary',
    'changing',
    'mutual',
    'movingLines',
    'meihua',
    'liuyao',
    'verdict',
    'score',
  ],
  qimen: [
    'pillars',
    'dun',
    'ju',
    'xunShou',
    'zhiFu',
    'zhiShi',
    'palaces',
    'useGods',
    'verdict',
    'score',
    'favorableDirections',
    'timing',
  ],
  tarot: ['spread', 'category', 'allowReversed', 'cards', 'stats', 'combos', 'yesNo'],
  astrology: [
    'noonChart',
    'houseSystem',
    'bodies',
    'angles',
    'houses',
    'aspects',
    'stats',
    'rulers',
    'patterns',
  ],
  vedic: ['noonChart', 'lagna', 'bodies', 'houses', 'moon', 'yogas'],
  // DESIGN-GAP: Numerology follow-up uses derived numbers only; exclude birthday, digit grid, dated cycles and target date.
  numerology: ['lifePath', 'nameNumbers', 'compatibility'],
  daily: [],
  synastry: ['bazi', 'western', 'ashtakoot', 'availability'],
};
const forbidden =
  /^(?:input|local|birth.*|displayName|email|nameZh|nameEn|place.*|location|lat|lng|latitude|longitude|tz|timezone|jdUT|lunar|castAt|solarTimeAdjust|solarTerms|panchangAtBirth|decadal|ages|question|seed|source|numbers)$/i;
const months =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
/** Redact known identities and common unsolicited identifier formats locally, before any provider call. */
export function redactChatText(text: string, identities: readonly string[] = []): string {
  let value = text.normalize('NFKC');
  for (const identity of [...new Set(identities)].sort((a, b) => b.length - a.length)) {
    if (!identity.trim()) continue;
    const escaped = identity.normalize('NFKC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    value = value.replace(new RegExp(escaped, 'giu'), '[redacted]');
  }
  // DESIGN-GAP: Free text may volunteer identifiers; strip full numeric/Chinese/English dates, clocks, emails and identity declarations too.
  return value
    .replace(/\b(?:19|20)\d{6}\b/g, '[redacted]')
    .replace(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]')
    .replace(
      /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,
      '[redacted]',
    )
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, '[redacted]')
    .replace(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日号]/g, '[redacted]')
    .replace(
      /[〇零一二三四五六七八九十]{4}年[零一二三四五六七八九十]{1,3}月[零一二三四五六七八九十]{1,3}[日号]/g,
      '[redacted]',
    )
    .replace(
      new RegExp(
        `\\b(?:${months}\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}|\\d{1,2}\\s+${months}[,]?\\s+\\d{4})\\b`,
        'gi',
      ),
      '[redacted]',
    )
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '[redacted]')
    .replace(/\d{1,2}\s*[点时]\s*(?:\d{1,2}\s*分)?/g, '[redacted]')
    .replace(
      /(?:我叫|姓名[是为:]|名字[是叫:]|出生[于在]|出生地[是为:]|住在|家乡[是为:])[^，。！？\n]{1,80}/g,
      '[redacted]',
    )
    .replace(
      /\b(?:my name is|named|born in|birthplace is|live in)\s+[^,.!?\n]{1,80}/gi,
      '[redacted]',
    );
}
/** Collect only identifiers from a decrypted local snapshot; this object is never sent to the model. */
export function privateIdentifiers(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(privateIdentifiers);
  return Object.entries(value).flatMap(([key, item]) =>
    /^(?:name|displayName|email|encName)$/i.test(key) && typeof item === 'string'
      ? [item]
      : privateIdentifiers(item),
  );
}
/** Project whitelisted chart roots and remove nested source clocks/identifiers; retain only derived elements. */
export function chatChart(
  system: System,
  chart: unknown,
  identities: readonly string[] = [],
): unknown {
  function clean(value: unknown): unknown {
    if (typeof value === 'string') return redactChatText(value, identities);
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbidden.test(key))
        .map(([key, item]) => [key, clean(item)]),
    );
  }
  const record = chart && typeof chart === 'object' ? (chart as Record<string, unknown>) : {};
  return clean(
    Object.fromEntries(
      roots[system].filter((key) => key in record).map((key) => [key, record[key]]),
    ),
  );
}
/** Build the sole provider payload from derived chart data, report prose and redacted dialogue; exclude evidence/debug/input. */
export async function chatMessages(input: {
  system: System;
  chart: unknown;
  report: unknown;
  locale: 'zh' | 'en' | 'zh-TW';
  question: string;
  identities: readonly string[];
  history: readonly { role: 'user' | 'assistant'; content: string }[];
}): Promise<LlmMessage[]> {
  const report = ReportSchema.parse(input.report);
  const previousQuestion =
    [...input.history].reverse().find((message) => message.role === 'user')?.content ?? '';
  const selected = selectChatSections(report.sections, input.question, previousQuestion);
  const proseLimit = input.locale === 'en' ? 2600 : 900;
  const sections = selected.map((section) => ({
    key: section.key,
    title: redactChatText(section.title, input.identities),
    lead: excerptChatText(
      redactChatText(section.lead, input.identities),
      input.locale === 'en' ? 500 : 180,
    ),
    text: excerptChatText(
      redactChatText(
        section.blocks
          .flatMap((block) =>
            block.type === 'paragraph' || block.type === 'transition'
              ? [block.text]
              : block.type === 'advice'
                ? block.items
                : [],
          )
          .join('\n'),
        input.identities,
      ),
      proseLimit,
    ),
  }));
  // DESIGN-GAP: Redact prose before JSON escaping so quoted/backslash-containing identities cannot bypass matching.
  const data = JSON.stringify({
    system: input.system,
    chart: chatChart(input.system, input.chart, input.identities),
    availableSections: report.sections.map((section) => section.key),
    sections,
  });
  // DESIGN-GAP: Cap excerpts and the latest three exchanges independently; never truncate serialized JSON or source chart facts.
  if (data.length > 30000) throw new Error('Chat context too large');
  const prompt = await resourceText('lib/llm/prompts/chat.md');
  return [
    {
      role: 'system',
      content: `${prompt}\nResponse language: ${input.locale}.\nUntrusted chart and report data:\n${data}`,
    },
    ...input.history.slice(-6).map((message) => ({
      role: message.role,
      content: excerptChatText(
        redactChatText(message.content, input.identities),
        input.locale === 'en' ? 1000 : 400,
      ),
    })),
    // DESIGN-GAP: Restate delivery constraints after long untrusted context/history; real evaluations showed language and verbosity drift.
    {
      role: 'system',
      content:
        input.locale === 'en'
          ? 'Final answer: English only, no Chinese characters, no raw field names. At most 140 words in 2–4 complete sentences. Plain prose, no Markdown. Refuse unsafe requests; do not ask for birth details.'
          : `Final answer: ${input.locale === 'zh-TW' ? 'Traditional' : 'Simplified'} Chinese only, no raw field names. At most 240 Unicode characters in 2–4 complete sentences. Plain prose, no Markdown. Refuse unsafe requests; do not ask for birth details.`,
    },
    { role: 'user', content: redactChatText(input.question, input.identities) },
  ];
}
/** Enforce the documented visible-answer limit independent of model compliance. */
export function boundAnswer(text: string, locale: 'zh' | 'en' | 'zh-TW'): string {
  return locale !== 'en'
    ? Array.from(text).slice(0, 300).join('')
    : (text.match(/\S+\s*/g) ?? []).slice(0, 200).join('').trimEnd();
}
