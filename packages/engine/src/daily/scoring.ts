import {
  DAILY_SCORE_RULES,
  type DailyDriver,
  type DailyScoreContext,
  type DailyScoreRule,
} from './score-rules';
export const DIMENSIONS = ['career', 'wealth', 'love', 'health', 'social'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
/** Clamp a daily score to the documented 15–95 point range.
 * @param value Accumulated score in points. */
export const clampDailyScore = (value: number): number => Math.max(15, Math.min(95, value));
/** Convert a daily score to its one-to-five-star display band.
 * @param score Daily dimension or overall score in points. */
export const dailyStars = (score: number): 1 | 2 | 3 | 4 | 5 =>
  score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1;
/** Select the documented daily oneliner band.
 * @param score Overall daily score in points. */
export const dailyBand = (score: number): 'great' | 'good' | 'mixed' | 'careful' =>
  score >= 85 ? 'great' : score >= 70 ? 'good' : score >= 55 ? 'mixed' : 'careful';
/** Smallest per-rule move that counts as a dimension's stated reason; weaker nudges only add up. */
const DRIVER_THRESHOLD = 3;
/** Lift the blended score so the overall rating spreads like its components rather than regressing to 60. */
const OVERALL_SPREAD = 1.5;
/** Name each dimension's main reason, in the direction the dimension actually moved, preferring a different rule per dimension. */
function selectDrivers(
  moves: { rule: DailyScoreRule; hit: string; delta: Partial<Record<Dimension, number>> }[],
  context: DailyScoreContext,
  scores: Record<Dimension, number>,
): Record<Dimension, DailyDriver | null> {
  const used = new Set<string>();
  const drivers = {} as Record<Dimension, DailyDriver | null>;
  for (const dim of DIMENSIONS) {
    const net = scores[dim] - 60;
    const candidates = moves
      .map((move) => ({ move, value: move.delta[dim] ?? 0 }))
      .filter(({ value }) => Math.abs(value) >= DRIVER_THRESHOLD && (net === 0 || value * net > 0))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const chosen = candidates.find(({ move }) => !used.has(move.rule.id)) ?? candidates[0];
    if (!chosen) {
      drivers[dim] = null;
      continue;
    }
    used.add(chosen.move.rule.id);
    const pillarKey = /^bazi\.branch\.(day|month|year|hour)\./.exec(chosen.move.hit)?.[1] as
      keyof NonNullable<DailyScoreContext['natalBranches']> | undefined;
    const natalBranch = pillarKey ? context.natalBranches?.[pillarKey] : undefined;
    drivers[dim] = {
      rule: chosen.move.rule.id,
      category: chosen.move.rule.driver,
      direction: chosen.value > 0 ? 'up' : 'down',
      hit: chosen.move.hit,
      ...(natalBranch ? { natalBranch } : {}),
    };
  }
  return drivers;
}
/** Apply matching daily rules once each, retaining evidence and deterministic dominant theme.
 * @param context Natal and daily inputs needed by the rules.
 * @param rules Ordered scoring table; defaults to the documented rule set. */
export function scoreDaily(context: DailyScoreContext, rules = DAILY_SCORE_RULES) {
  const scores: Record<Dimension, number> = {
    career: 60,
    wealth: 60,
    love: 60,
    health: 60,
    social: 60,
  };
  const findings: string[] = [];
  const moves: { rule: DailyScoreRule; hit: string; delta: Partial<Record<Dimension, number>> }[] =
    [];
  let theme = context.god,
    dominantWeight = 0;
  for (const rule of rules) {
    const hits = rule.matches(context);
    if (!hits.length) continue;
    findings.push(...hits);
    // DESIGN-GAP: Apply each table row once even if multiple relations/aspects match, but retain every evidence key; clamp after all rows.
    const delta = typeof rule.delta === 'function' ? rule.delta(context) : rule.delta;
    moves.push({ rule, hit: hits[0]!, delta });
    const weight = DIMENSIONS.reduce((sum, dim) => sum + Math.abs(delta[dim] ?? 0), 0);
    DIMENSIONS.forEach((dim) => (scores[dim] += delta[dim] ?? 0));
    // DESIGN-GAP: Dominant theme is the row with greatest total absolute impact; table order breaks ties, using ten-god themes for the ~4×10 oneliner keys.
    if (weight > dominantWeight) {
      dominantWeight = weight;
      theme = rule.theme;
    }
  }
  const drivers = selectDrivers(moves, context, scores);
  DIMENSIONS.forEach((dim) => (scores[dim] = clampDailyScore(scores[dim])));
  const blended =
    scores.career * 0.25 +
    scores.wealth * 0.2 +
    scores.love * 0.2 +
    scores.health * 0.2 +
    scores.social * 0.15;
  const overall = Math.round(clampDailyScore(60 + (blended - 60) * OVERALL_SPREAD) * 100) / 100;
  return {
    scores: { ...scores, overall },
    findings: [...new Set(findings)],
    oneLiner: `daily.oneliner.${dailyBand(overall)}.${theme}`,
    drivers,
  };
}
