import type { BaziChart, DailyChart, DailyTransit, TenGod } from '@tianji/shared';
export const DIMENSIONS = ['career', 'wealth', 'love', 'health', 'social'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
type Delta = Partial<Record<Dimension, number>>;
export interface DailyScoreContext {
  god: TenGod;
  strength: BaziChart['strength']['level'];
  favorableHit: boolean;
  unfavorableHit: boolean;
  dayRelations: DailyChart['bazi']['branchRelations'];
  secondaryRelations: DailyChart['bazi']['secondaryRelations'];
  astro: DailyChart['astro'];
  tarot: DailyChart['tarot'];
}
export interface DailyScoreRule {
  id: string;
  theme: TenGod;
  matches: (context: DailyScoreContext) => string[];
  delta: Delta | ((context: DailyScoreContext) => Delta);
}
const gods =
  (...values: TenGod[]) =>
  (c: DailyScoreContext) =>
    values.includes(c.god) ? [`bazi.tenGod.${c.god}.${c.strength}`] : [];
// DESIGN-GAP: Balanced strength gives zero strength-dependent delta; fixed table bonuses still apply.
const strengthSign = (c: DailyScoreContext) =>
  c.strength === 'strong' ? 1 : c.strength === 'weak' ? -1 : 0;
const day =
  (...types: string[]) =>
  (c: DailyScoreContext) =>
    c.dayRelations
      .filter((r) => r.pillar === 'day' && types.includes(r.type))
      .map((r) => `bazi.branch.day.${r.type}`);
const transitKey = (t: DailyTransit) => `astro.transit.${t.transiting}_${t.aspect}_${t.natal}`;
const transits = (planet: string, natal: string[], aspects: string[]) => (c: DailyScoreContext) =>
  c.astro.transits
    .filter((t) => t.transiting === planet && natal.includes(t.natal) && aspects.includes(t.aspect))
    .map(transitKey);
const all = (value: number): Delta => ({
  career: value,
  wealth: value,
  love: value,
  health: value,
  social: value,
});
export const AUSPICIOUS_CARDS = [
  'major_19_sun',
  'major_17_star',
  'major_21_world',
  'cups_10',
  'cups_09',
  'wands_06',
  'pentacles_10',
  'major_06_lovers',
  'major_03_empress',
] as const;
export const CAUTION_CARDS = [
  'major_16_tower',
  'major_15_devil',
  'swords_10',
  'swords_03',
  'swords_09',
] as const;
/** §3.5 in table order; scoring behavior is data rather than a chain of imperative conditions. */
export const DAILY_SCORE_RULES: readonly DailyScoreRule[] = [
  {
    id: 'officer',
    theme: 'zheng_guan',
    matches: gods('zheng_guan', 'qi_sha'),
    delta: (c) => ({ career: 10 * strengthSign(c), social: 4 * strengthSign(c) }),
  },
  {
    id: 'wealth',
    theme: 'zheng_cai',
    matches: gods('zheng_cai', 'pian_cai'),
    delta: (c) => ({ wealth: 12 * strengthSign(c), love: 4 }),
  },
  {
    id: 'output',
    theme: 'shi_shen',
    matches: gods('shi_shen', 'shang_guan'),
    delta: (c) => ({
      career: 4,
      wealth: 3,
      love: 5,
      health: c.god === 'shang_guan' ? -3 : 0,
      social: 3,
    }),
  },
  {
    id: 'resource',
    theme: 'zheng_yin',
    matches: gods('zheng_yin', 'pian_yin'),
    delta: { career: 3, wealth: -4, health: 5 },
  },
  {
    id: 'peer',
    theme: 'bi_jian',
    matches: gods('bi_jian', 'jie_cai'),
    delta: (c) => ({ career: 2, wealth: c.god === 'jie_cai' ? -8 : 0, love: -4, social: 6 }),
  },
  {
    id: 'favorable',
    theme: 'shi_shen',
    matches: (c) => (c.favorableHit ? ['bazi.favorableHit'] : []),
    delta: { career: 8, wealth: 8, love: 6, health: 8, social: 6 },
  },
  {
    id: 'unfavorable',
    theme: 'pian_yin',
    matches: (c) => (c.unfavorableHit ? ['bazi.unfavorableHit'] : []),
    delta: { career: -8, wealth: -8, love: -6, health: -8, social: -6 },
  },
  {
    id: 'combine',
    theme: 'zheng_cai',
    matches: day('combine', 'tri_combine'),
    delta: { career: 5, wealth: 4, love: 10, health: 4, social: 8 },
  },
  {
    id: 'clash',
    theme: 'qi_sha',
    matches: day('clash'),
    delta: { career: -6, wealth: -5, love: -10, health: -6, social: -8 },
  },
  {
    id: 'punish_harm',
    theme: 'pian_yin',
    matches: day('punish', 'harm'),
    delta: { career: -4, wealth: -3, love: -6, health: -5, social: -6 },
  },
  {
    id: 'secondary_clash',
    theme: 'qi_sha',
    matches: (c) =>
      c.secondaryRelations
        .filter((r) => r.type === 'clash')
        .map((r) => `bazi.secondary.${r.target}.${r.kind}.clash`),
    delta: { career: -4, wealth: -4, love: -3, health: -3, social: -3 },
  },
  {
    id: 'moon_support',
    theme: 'zheng_cai',
    matches: transits('moon', ['venus', 'moon'], ['conjunction', 'trine', 'sextile']),
    delta: { love: 8, health: 3, social: 5 },
  },
  {
    id: 'moon_tension',
    theme: 'pian_yin',
    matches: transits('moon', ['sun', 'moon'], ['opposition', 'square']),
    delta: { career: -3, love: -6, health: -5, social: -4 },
  },
  {
    id: 'mars_tension',
    theme: 'qi_sha',
    matches: transits('mars', ['sun', 'mars'], ['opposition', 'square']),
    delta: { career: -5, wealth: -3, love: -5, health: -6, social: -5 },
  },
  {
    id: 'jupiter_support',
    theme: 'pian_cai',
    matches: transits('jupiter', ['sun', 'moon', 'asc'], ['conjunction', 'trine']),
    delta: { career: 6, wealth: 8, love: 4, health: 4, social: 4 },
  },
  {
    id: 'saturn_tension',
    theme: 'zheng_guan',
    matches: transits('saturn', ['sun', 'moon', 'asc'], ['opposition', 'square']),
    delta: { career: -6, wealth: -4, love: -3, health: -4, social: -3 },
  },
  {
    id: 'mercury_retrograde',
    theme: 'zheng_yin',
    matches: (c) => (c.astro.retrogrades.includes('mercury') ? ['astro.retrograde.mercury'] : []),
    delta: { career: -3, wealth: -2, social: -3 },
  },
  {
    id: 'tarot_auspicious',
    theme: 'shi_shen',
    matches: (c) =>
      !c.tarot.reversed && AUSPICIOUS_CARDS.some((card) => card === c.tarot.card)
        ? [`tarot.auspicious.${c.tarot.card}`]
        : [],
    delta: all(2),
  },
  {
    id: 'tarot_caution',
    theme: 'pian_yin',
    matches: (c) =>
      CAUTION_CARDS.some((card) => card === c.tarot.card) ||
      (c.tarot.card === 'major_18_moon' && c.tarot.reversed)
        ? [`tarot.caution.${c.tarot.card}`]
        : [],
    delta: all(-2),
  },
];
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
  let theme = context.god,
    dominantWeight = 0;
  for (const rule of rules) {
    const hits = rule.matches(context);
    if (!hits.length) continue;
    findings.push(...hits);
    // DESIGN-GAP: Apply each table row once even if multiple relations/aspects match, but retain every evidence key; clamp after all rows.
    const delta = typeof rule.delta === 'function' ? rule.delta(context) : rule.delta;
    const weight = DIMENSIONS.reduce((sum, dim) => sum + Math.abs(delta[dim] ?? 0), 0);
    DIMENSIONS.forEach((dim) => (scores[dim] += delta[dim] ?? 0));
    // DESIGN-GAP: Dominant theme is the row with greatest total absolute impact; table order breaks ties, using ten-god themes for the ~4×10 oneliner keys.
    if (weight > dominantWeight) {
      dominantWeight = weight;
      theme = rule.theme;
    }
  }
  DIMENSIONS.forEach((dim) => (scores[dim] = clampDailyScore(scores[dim])));
  const overall =
    Math.round(
      (scores.career * 0.25 +
        scores.wealth * 0.2 +
        scores.love * 0.2 +
        scores.health * 0.2 +
        scores.social * 0.15) *
        100,
    ) / 100;
  return {
    scores: { ...scores, overall },
    findings: [...new Set(findings)],
    oneLiner: `daily.oneliner.${dailyBand(overall)}.${theme}`,
  };
}
