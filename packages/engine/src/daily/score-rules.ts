import type { BaziChart, DailyChart, TenGod } from '@tianji/shared';
import type { Dimension } from './scoring';
import { SKY_SCORE_RULES } from './score-rules-sky';
type Delta = Partial<Record<Dimension, number>>;
export type DriverCategory =
  | 'officer'
  | 'wealth'
  | 'output'
  | 'resource'
  | 'peer'
  | 'element'
  | 'harmony'
  | 'friction'
  | 'cycle'
  | 'support'
  | 'tension'
  | 'retrograde'
  | 'card';
/** The strongest reason one dimension moved today; message keys derive from category, dimension and direction. */
export interface DailyDriver {
  rule: string;
  category: DriverCategory;
  direction: 'up' | 'down';
  /** Evidence key of the rule's first hit, e.g. `bazi.branch.month.combine`. */
  hit: string;
  /** Natal pillar branch the flow-day branch related to, when the driver is a branch relation. */
  natalBranch?: string;
}
export interface DailyScoreContext {
  god: TenGod;
  /** Ten god of the flow-day branch's main hidden stem; omitted callers score only the day stem. */
  branchGod?: TenGod;
  strength: BaziChart['strength']['level'];
  favorableHit: boolean;
  unfavorableHit: boolean;
  dayRelations: DailyChart['bazi']['branchRelations'];
  natalBranches?: Partial<Record<'day' | 'month' | 'year' | 'hour', string>>;
  secondaryRelations: DailyChart['bazi']['secondaryRelations'];
  astro: Pick<DailyChart['astro'], 'transits' | 'retrogrades'>;
  tarot: DailyChart['tarot'];
}
export interface DailyScoreRule {
  id: string;
  theme: TenGod;
  /** Copy family used when this rule is the strongest reason a dimension moved. */
  driver: DriverCategory;
  matches: (context: DailyScoreContext) => string[];
  delta: Delta | ((context: DailyScoreContext) => Delta);
}
const groups: Record<'officer' | 'wealth' | 'output' | 'resource' | 'peer', TenGod[]> = {
  officer: ['zheng_guan', 'qi_sha'],
  wealth: ['zheng_cai', 'pian_cai'],
  output: ['shi_shen', 'shang_guan'],
  resource: ['zheng_yin', 'pian_yin'],
  peer: ['bi_jian', 'jie_cai'],
};
type GodGroup = keyof typeof groups;
const groupOf = (god: TenGod) =>
  (Object.keys(groups) as GodGroup[]).find((key) => groups[key].includes(god))!;
/** Each ten god pulls mainly on the life area it classically governs. */
const focusOf: Record<GodGroup, Dimension> = {
  officer: 'career',
  wealth: 'wealth',
  output: 'love',
  resource: 'health',
  peer: 'social',
};
// DESIGN-GAP: §3.5 gave balanced charts zero strength-dependent delta, which removed officer and wealth days entirely from about a third of profiles; balanced now takes a half-strength lean by polarity.
const strengthLean = (c: DailyScoreContext, god: TenGod, balanced: number) =>
  c.strength === 'strong'
    ? 1
    : c.strength === 'weak'
      ? -0.75
      : god === 'qi_sha'
        ? -balanced
        : balanced;
const round = (delta: Delta): Delta =>
  Object.fromEntries(
    Object.entries(delta).map(([dim, value]) => [dim, Math.round(value)]),
  ) as Delta;
/** Ten-god deltas, shared by the day stem and (at half weight) the branch's main hidden stem. */
function godDelta(c: DailyScoreContext, god: TenGod): Delta {
  switch (groupOf(god)) {
    case 'officer': {
      const lean = strengthLean(c, god, 0.5);
      return { career: 12 * lean, social: 4 * lean, health: god === 'qi_sha' ? -3 : 0 };
    }
    case 'wealth': {
      const lean = strengthLean(c, god, 0.5);
      return { wealth: 13 * lean, love: 4 };
    }
    case 'output':
      return god === 'shi_shen'
        ? { career: 2, wealth: 2, love: 6, health: 4, social: 7 }
        : { career: -3, wealth: 5, love: 3, health: -5, social: -4 };
    case 'resource':
      return god === 'zheng_yin'
        ? { career: 5, wealth: -5, love: 2, health: 9 }
        : { career: 2, wealth: -6, love: -3, health: 6, social: -5 };
    case 'peer':
      return god === 'bi_jian'
        ? { career: 3, wealth: -2, love: -4, health: 3, social: 9 }
        : { career: 1, wealth: -11, love: -6, health: -2, social: 4 };
  }
}
const halve = (delta: Delta): Delta =>
  Object.fromEntries(Object.entries(delta).map(([dim, value]) => [dim, value / 2])) as Delta;
const gods = (group: GodGroup) => (c: DailyScoreContext) =>
  groups[group].includes(c.god) ? [`bazi.tenGod.${c.god}.${c.strength}`] : [];
const branchGods = (group: GodGroup) => (c: DailyScoreContext) =>
  c.branchGod && groups[group].includes(c.branchGod) ? [`bazi.branchGod.${c.branchGod}`] : [];
const pillar =
  (key: string, ...types: string[]) =>
  (c: DailyScoreContext) =>
    c.dayRelations
      .filter((r) => r.pillar === key && types.includes(r.type))
      .map((r) => `bazi.branch.${key}.${r.type}`);
const secondary = (target: 'year' | 'luck', type: 'clash' | 'combine') => (c: DailyScoreContext) =>
  c.secondaryRelations
    .filter((r) => r.target === target && r.type === type)
    .map((r) => `bazi.secondary.${target}.${r.kind}.${type}`);
const all = (value: number): Delta => ({
  career: value,
  wealth: value,
  love: value,
  health: value,
  social: value,
});
const SUIT_FOCUS: Record<string, Dimension> = {
  wands: 'career',
  pentacles: 'wealth',
  cups: 'love',
  swords: 'social',
};
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
const godRule = (group: GodGroup, theme: TenGod): DailyScoreRule => ({
  id: group,
  theme,
  driver: group,
  matches: gods(group),
  delta: (c) => round(godDelta(c, c.god)),
});
const branchRule = (group: GodGroup, theme: TenGod): DailyScoreRule => ({
  id: `branch_${group}`,
  theme,
  driver: group,
  matches: branchGods(group),
  delta: (c) => (c.branchGod ? round(halve(godDelta(c, c.branchGod))) : {}),
});
// DESIGN-GAP: docs/systems/daily §3.5 scored only day-pillar relations and applied near-uniform deltas, leaving 65% of same-day dimension pairs on one star. V2 keeps the 60-point base and 15–95 clamp but routes each trigger to the life area it classically governs (month→career, day→love, year→social, hour→health/wealth) and adds Venus, Mercury, Sun and tarot-suit signals.
/** Data-driven scoring table; rules that share a `driver` also share their explanatory copy. */
export const DAILY_SCORE_RULES: readonly DailyScoreRule[] = [
  godRule('officer', 'zheng_guan'),
  godRule('wealth', 'zheng_cai'),
  godRule('output', 'shi_shen'),
  godRule('resource', 'zheng_yin'),
  godRule('peer', 'bi_jian'),
  branchRule('officer', 'zheng_guan'),
  branchRule('wealth', 'zheng_cai'),
  branchRule('output', 'shi_shen'),
  branchRule('resource', 'zheng_yin'),
  branchRule('peer', 'bi_jian'),
  {
    id: 'favorable',
    theme: 'shi_shen',
    driver: 'element',
    matches: (c) => (c.favorableHit ? ['bazi.favorableHit'] : []),
    delta: (c) => ({ ...all(4), [focusOf[groupOf(c.god)]]: 10 }),
  },
  {
    id: 'unfavorable',
    theme: 'pian_yin',
    driver: 'element',
    matches: (c) => (c.unfavorableHit ? ['bazi.unfavorableHit'] : []),
    delta: (c) => ({ ...all(-4), [focusOf[groupOf(c.god)]]: -11 }),
  },
  {
    id: 'combine',
    theme: 'zheng_cai',
    driver: 'harmony',
    matches: pillar('day', 'combine', 'tri_combine'),
    delta: { love: 12, health: 2, social: 4 },
  },
  {
    id: 'clash',
    theme: 'qi_sha',
    driver: 'friction',
    matches: pillar('day', 'clash'),
    delta: { love: -12, health: -5, social: -3 },
  },
  {
    id: 'punish_harm',
    theme: 'pian_yin',
    driver: 'friction',
    matches: pillar('day', 'punish', 'harm'),
    delta: { love: -7, health: -4, social: -2 },
  },
  {
    id: 'month_combine',
    theme: 'zheng_guan',
    driver: 'harmony',
    matches: pillar('month', 'combine', 'tri_combine'),
    delta: { career: 10, wealth: 3 },
  },
  {
    id: 'month_clash',
    theme: 'qi_sha',
    driver: 'friction',
    matches: pillar('month', 'clash', 'punish', 'harm'),
    delta: { career: -10, wealth: -2, social: -2 },
  },
  {
    id: 'year_combine',
    theme: 'bi_jian',
    driver: 'harmony',
    matches: pillar('year', 'combine', 'tri_combine'),
    delta: { career: 1, love: 2, social: 9 },
  },
  {
    id: 'year_clash',
    theme: 'jie_cai',
    driver: 'friction',
    matches: pillar('year', 'clash', 'punish', 'harm'),
    delta: { wealth: -3, social: -9 },
  },
  {
    id: 'hour_combine',
    theme: 'zheng_yin',
    driver: 'harmony',
    matches: pillar('hour', 'combine', 'tri_combine'),
    delta: { wealth: 5, health: 7 },
  },
  {
    id: 'hour_clash',
    theme: 'pian_yin',
    driver: 'friction',
    matches: pillar('hour', 'clash', 'punish', 'harm'),
    delta: { wealth: -5, health: -7 },
  },
  {
    id: 'luck_clash',
    theme: 'qi_sha',
    driver: 'cycle',
    matches: secondary('luck', 'clash'),
    delta: { career: -4, wealth: -3, health: -3 },
  },
  {
    id: 'year_cycle_clash',
    theme: 'qi_sha',
    driver: 'cycle',
    matches: secondary('year', 'clash'),
    delta: { wealth: -3, love: -2, social: -4 },
  },
  {
    id: 'luck_combine',
    theme: 'zheng_yin',
    driver: 'cycle',
    matches: secondary('luck', 'combine'),
    delta: { career: 3, wealth: 3 },
  },
  {
    id: 'year_cycle_combine',
    theme: 'shi_shen',
    driver: 'cycle',
    matches: secondary('year', 'combine'),
    delta: { love: 2, social: 3 },
  },
  ...SKY_SCORE_RULES,
  {
    id: 'tarot_auspicious',
    theme: 'shi_shen',
    driver: 'card',
    matches: (c) =>
      !c.tarot.reversed && AUSPICIOUS_CARDS.some((card) => card === c.tarot.card)
        ? [`tarot.auspicious.${c.tarot.card}`]
        : [],
    delta: all(2),
  },
  {
    id: 'tarot_caution',
    theme: 'pian_yin',
    driver: 'card',
    matches: (c) =>
      CAUTION_CARDS.some((card) => card === c.tarot.card) ||
      (c.tarot.card === 'major_18_moon' && c.tarot.reversed)
        ? [`tarot.caution.${c.tarot.card}`]
        : [],
    delta: all(-2),
  },
  {
    id: 'tarot_suit',
    theme: 'shi_shen',
    driver: 'card',
    matches: (c) => {
      const suit = c.tarot.card.split('_')[0]!;
      return suit in SUIT_FOCUS
        ? [`tarot.suit.${suit}.${c.tarot.reversed ? 'reversed' : 'upright'}`]
        : [];
    },
    delta: (c) => ({ [SUIT_FOCUS[c.tarot.card.split('_')[0]!]!]: c.tarot.reversed ? -3 : 4 }),
  },
];
