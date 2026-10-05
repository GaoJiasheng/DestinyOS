import type { Report } from '@tianji/interpret';

type Section = Report['sections'][number];
// DESIGN-GAP: Retrieval has no documented algorithm; deterministic bilingual topic matching selects at most two relevant chapters without an extra model call.
const topics: readonly { match: RegExp; keys: readonly string[] }[] = [
  {
    match: /流年|大运|时机|时间|日期|今年|升职|annual|cycle|timing|this year|date|promot/i,
    keys: ['luck_timeline', 'decadal_yearly', 'transits_now', 'timing', 'cycles', 'answer'],
  },
  {
    match:
      /合盘|伴侣|感情|夫妻|沟通|不爱|不回复|synastry|partner|relationship|love|communication|reply/i,
    keys: [
      'love',
      'love_family',
      'love_career',
      'compatibility',
      'love_marriage',
      'dynamics',
      'cards',
    ],
  },
  {
    match: /事业|工作|同事|career|job|work|colleague/i,
    keys: ['pattern_career', 'career_wealth', 'love_career', 'cards', 'answer'],
  },
  {
    match: /健康|疾病|作息|病|药|health|wellbeing|disease|routine|medication/i,
    keys: ['health', 'health_travel', 'health_energy', 'advice', 'summary_actions'],
  },
  {
    match: /钱|理财|投资|股票|财富|money|wealth|invest|stock|return/i,
    keys: ['wealth', 'career_wealth', 'houses', 'cards', 'answer'],
  },
  { match: /牌阵|逆位|牌|tarot|spread|card|reversal/i, keys: ['cards', 'dynamics', 'answer'] },
  { match: /日主|day master|性格|personality/i, keys: ['day_master', 'life_palace', 'big_three'] },
  { match: /五行|喜用|elements|elemental|用神/i, keys: ['elements', 'day_master', 'big_three'] },
  { match: /身宫|福德|body palace/i, keys: ['body_fortune', 'life_palace'] },
  {
    match: /四化|空宫|星曜|命宫|mutagen|transformation|empty palace|life palace/i,
    keys: ['life_palace', 'patterns'],
  },
  {
    match: /相位|行星|上升|太阳|月亮|aspect|planet|rising|sun|moon/i,
    keys: ['big_three', 'aspects', 'planets', 'houses'],
  },
  { match: /行动|优势|strength|action/i, keys: ['summary_actions', 'advice', 'overview'] },
];
/** Select relevant original sections; ambiguous follow-ups reuse the latest user topic, never assistant instructions. */
export function selectChatSections(
  sections: readonly Section[],
  question: string,
  previousQuestion = '',
): Section[] {
  const matches = topics.filter((topic) => topic.match.test(question));
  const relevant = matches.length
    ? matches
    : topics.filter((topic) => topic.match.test(previousQuestion));
  const keys = [...new Set(relevant.flatMap((topic) => topic.keys))];
  const selected = keys
    .flatMap((key) => sections.filter((section) => section.key === key))
    .slice(0, 2);
  if (selected.length) return selected;
  return ['overview', 'summary_actions', 'advice']
    .flatMap((key) => sections.filter((section) => section.key === key))
    .slice(0, 2);
}
/** Trim prose at sentence boundaries where possible, preserving valid Unicode and complete JSON structure. */
export function excerptChatText(text: string, limit: number): string {
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  const bounded = chars.slice(0, limit).join('');
  const ending = Math.max(
    bounded.lastIndexOf('。'),
    bounded.lastIndexOf('！'),
    bounded.lastIndexOf('？'),
    bounded.lastIndexOf('. '),
  );
  return (ending > bounded.length / 2 ? bounded.slice(0, ending + 1) : bounded) + '…';
}
