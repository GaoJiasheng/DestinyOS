import type { Locale } from '@tianji/shared';
/**
 * Report-assembly prose compaction. Knowledge units are written to stand alone, so a composed report
 * repeats their shared closing caveats and template sentences. The report states that caveat once in
 * its summary ("how to use this report"), so assembly removes the standing caveats and keeps only the
 * first occurrence of any other repeated sentence.
 */
type ProseLocale = Exclude<Locale, 'zh-TW'>;
export type ProseCompactor = {
  paragraph: (text: string, polarity: string) => string;
  startSection: () => void;
};
const terminator = /[。！？；.!?;]+[”」』）)]?$/;
const boundary: Record<ProseLocale, RegExp> = {
  zh: /(?<=[。！？；][”」』）]?)/,
  en: /(?<=[.!?;][”’")]?)(?=\s)/,
};
// A sentence opening with one of these leans on the sentence before it.
const dependent: Record<ProseLocale, RegExp> = {
  zh: /^(它|这|其|那|该|此|但|而|也|所以|因此|并且)/,
  en: /^(it|this|that|these|those|they|their|however|but|so|and)\b/i,
};
// Editorial rule: a negative unit must keep the softening its source body carried.
const buffered: Record<ProseLocale, RegExp> = {
  zh: /不过|可以通过|建议/,
  en: /\b(that said|still|however|you can|consider|try)\b/i,
};
/** Meta caveats duplicated by the report-level usage note; matched without trailing punctuation. */
const standingCaveats: Record<ProseLocale, ReadonlySet<string>> = {
  zh: new Set([
    '你可以先从一次具体经历检验这个角度，再决定它是否值得放进自己的行动计划',
    '传统标记只能提供提问，不能替代现实判断',
    '传统描述提供的是观察线索，不替代对现实条件的判断',
    '时间层次改变观察范围，不替你预告某种具体结果',
    '若现实信息不同，及时修正理解，不把象征当成行动命令',
    '可以把后续实际反馈记下来，再决定这条线索是否适合你的处境',
    '把尝试之后的新信息也纳入判断，若这个角度与你的经历不符，就调整观察方法，不必让名称限制自己的选择',
    '合盘提供一种讨论差异的语言，结果需要与真实经历一起看',
  ]),
  en: new Set([
    'You can compare this prompt with a real example and retain only what helps you describe the practical situation more clearly',
    'You can check which detail matches an actual situation, ask for relevant feedback, and revise the next step using what you learn',
    'Keep the reflection open to information that the chart itself cannot supply',
    'A chart offers a starting point for reflection, while each person remains free to choose how to participate',
    'the angle is a symbolic prompt rather than a forecast of an event',
    'the placement offers a question to explore in your own circumstances',
    'A timing layer changes the scope of reflection without identifying a particular event or deciding its outcome',
  ]),
};
/** Trailing Chinese clauses that restate the usage note inside an otherwise specific sentence. */
const standingTails: ReadonlySet<string> = new Set([
  '用现实反馈判断这个角度是否贴合你',
  '再核对这一步是否符合已经答应的事项',
  '再用实际结果判断这次调整是否合适',
]);
const keyOf = (token: string) => token.trim().replace(terminator, '');
/** Create a report-scoped compactor; call it on each knowledge paragraph in reading order.
 * @param locale Assembled report language; zh-TW is localized from the compacted zh report.
 * @param scope Report-wide removal, or per-section when a whole-report pass falls under the length floor.
 * @returns `paragraph` returns the compacted text, or '' when nothing new remains. */
export function createProseCompactor(
  locale: ProseLocale,
  scope: 'report' | 'section' = 'report',
): ProseCompactor {
  const seen = new Set<string>();
  const stripTail = (token: string): string => {
    if (locale !== 'zh' || !token.endsWith('。')) return token;
    const parts = token.slice(0, -1).split('，');
    const tail = parts.at(-1) ?? '';
    return parts.length > 1 && standingTails.has(tail)
      ? `${parts.slice(0, -1).join('，')}。`
      : token;
  };
  const paragraph = (text: string, polarity: string): string => {
    const tokens = text.split(boundary[locale]);
    const keys = tokens.map(keyOf);
    const removed = keys.map((key) => {
      if (!key) return false;
      if (standingCaveats[locale].has(key)) return true;
      const repeated = seen.has(key);
      seen.add(key);
      return repeated;
    });
    // Keep a repeated sentence when the sentence after it stays and depends on it.
    for (let i = tokens.length - 2; i >= 0; i--)
      if (removed[i] && !removed[i + 1] && dependent[locale].test(tokens[i + 1]!.trim()))
        removed[i] = false;
    const kept: string[] = [];
    tokens.forEach((token, i) => {
      if (removed[i]) return;
      let next = stripTail(token);
      const opensSentence = !kept.length || /[.!?][”’")]?$/.test(kept.at(-1)!.trimEnd());
      if (i > 0 && removed[i - 1] && opensSentence)
        next = next.replace(/^(\s*)([a-z])/, (_, space: string, letter: string) => {
          return `${space}${letter.toUpperCase()}`;
        });
      kept.push(next);
    });
    const result = kept.join('').trim().replace(/；$/, '。').replace(/;$/, '.');
    if (polarity === 'negative' && buffered[locale].test(text) && !buffered[locale].test(result))
      return text;
    return result;
  };
  /** Mark a new report section; 'section' scope only removes repeats within one section. */
  const startSection = () => {
    if (scope !== 'section') return;
    seen.clear();
  };
  return { paragraph, startSection };
}
/** Pass-through compactor for report types with their own wording rules. */
export const identityCompactor: ProseCompactor = {
  paragraph: (text) => text,
  startSection: () => undefined,
};
