import type { TokenUsage } from '../apps/web/lib/llm/minimax';
/** Sum persisted provider token counts without estimating missing receipts.
 * @param items Completed audit receipts containing provider usage.
 */
export const sumUsage = (items: { usage: TokenUsage }[]) =>
  items.reduce(
    (total, row) => ({
      promptTokens: total.promptTokens + row.usage.promptTokens,
      completionTokens: total.completionTokens + row.usage.completionTokens,
      totalTokens: total.totalTokens + row.usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
/** Estimate the existing uncached audit list-price cost in USD.
 * @param usage Provider prompt and completion token counts.
 */
export const cost = (usage: TokenUsage) =>
  (usage.promptTokens * 0.3 + usage.completionTokens * 1.2) / 1e6;
