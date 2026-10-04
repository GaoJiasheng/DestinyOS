import type { BaziChart, Contribution, StrengthDetail, Element } from '@tianji/shared';
import { ELEMENTS, STEM_ELEMENTS, HIDDEN_STEMS, tenGod, mod } from '../common/ganzhi';
import { pillarEntries, HIDDEN_WEIGHTS } from './pillars';
const round = (n: number) => Math.round(n * 1e8) / 1e8;
/** Transparent §4 distribution; hidden stems weighted 1/.5/.3, month main +1. */
export function elementDistribution(pillars: BaziChart['pillars']): BaziChart['elements'] {
  const contributions: Contribution[] = [];
  for (const [pillar, p] of pillarEntries(pillars)) {
    contributions.push({ pillar, source: 'stem', stem: p.stem, element: p.stemElement, weight: 1 });
    p.hiddenStems.forEach((h, i) =>
      contributions.push({
        pillar,
        source: h.role,
        stem: h.stem,
        element: STEM_ELEMENTS[h.stem],
        weight: HIDDEN_WEIGHTS[i]!,
      }),
    );
  }
  const main = pillars.month.hiddenStems[0]!.stem;
  contributions.push({
    pillar: 'month',
    source: 'month_bonus',
    stem: main,
    element: STEM_ELEMENTS[main],
    weight: 1,
  });
  const raw = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  contributions.forEach((c) => (raw[c.element] = round(raw[c.element] + c.weight)));
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const pct = { ...raw };
  ELEMENTS.forEach((e) => (pct[e] = round((raw[e] / total) * 100)));
  return { raw, pct, contributions };
}
/** weighted_v1 score in documented weight units; unknown hour −.30, balance −.15 confidence. */
export function assessStrength(pillars: BaziChart['pillars']): BaziChart['strength'] {
  const dm = pillars.day.stemElement;
  const support = (e: Element) => e === dm || ELEMENTS[mod(ELEMENTS.indexOf(dm) - 1, 5)] === e;
  const details: StrengthDetail[] = [];
  const month = pillars.month;
  const main = month.hiddenStems[0]!;
  const getsSeason = support(STEM_ELEMENTS[main.stem]);
  // DESIGN-GAP: §5.1 main support takes precedence over middle qi; the middle bonus applies only to identical day-master element.
  const season = getsSeason
    ? 3
    : month.hiddenStems.some((h) => h.role === 'middle' && STEM_ELEMENTS[h.stem] === dm)
      ? 1.5
      : 0;
  details.push({
    pillar: 'month',
    source: 'season',
    element: season === 1.5 ? dm : STEM_ELEMENTS[main.stem],
    score: season,
  });
  for (const [pillar, p] of pillarEntries(pillars)) {
    details.push({
      pillar,
      source: 'stem',
      element: p.stemElement,
      score: support(p.stemElement) ? 1 : -1,
    });
    p.hiddenStems.forEach((h, i) => {
      const e = STEM_ELEMENTS[h.stem];
      // DESIGN-GAP: Positive month hidden qi is represented by 得令; negative month hidden qi uses normal weights (§5.4).
      if (pillar !== 'month' || !support(e))
        details.push({
          pillar,
          source: h.role,
          element: e,
          score: HIDDEN_WEIGHTS[i]! * (support(e) ? 1 : -1),
        });
    });
  }
  const score = round(details.reduce((n, d) => n + d.score, 0));
  const alone = season === 0 && details.filter((d) => d.score > 0).length === 1;
  const level = alone || score <= -2.5 ? 'weak' : score >= 2.5 ? 'strong' : 'balanced';
  return {
    score,
    level,
    details,
    confidence: round(1 - (pillars.hour ? 0 : 0.3) - (level === 'balanced' ? 0.15 : 0)),
  };
}
/** Favors support/drain by strength, with independent winter-fire and summer-water tags. */
export function selectUseGod(
  pillars: BaziChart['pillars'],
  strength: BaziChart['strength'],
  elements: BaziChart['elements'],
): BaziChart['useGod'] {
  const dm = pillars.day.stemElement;
  const supports = ELEMENTS.filter(
    (e) => e === dm || e === ELEMENTS[mod(ELEMENTS.indexOf(dm) - 1, 5)],
  );
  const drains = ELEMENTS.filter((e) => !supports.includes(e));
  // DESIGN-GAP: “少” means <10% of distribution; balanced charts prefer the seasonal correction, or all five if none.
  const tiaoHou: Element | undefined =
    ['hai', 'zi', 'chou'].includes(pillars.month.branch) && elements.pct.fire < 10
      ? 'fire'
      : ['si', 'wu', 'wei'].includes(pillars.month.branch) && elements.pct.water < 10
        ? 'water'
        : undefined;
  const group =
    strength.level === 'strong' ? 'drain' : strength.level === 'weak' ? 'support' : 'balance';
  const favorable: Element[] =
    group === 'support'
      ? supports
      : group === 'drain'
        ? drains
        : tiaoHou
          ? [tiaoHou]
          : [...ELEMENTS];
  return {
    favorable,
    unfavorable: ELEMENTS.filter((e) => !favorable.includes(e)),
    group,
    ...(tiaoHou ? { tiaoHou } : {}),
    rationale: [`bazi.rules.${group}`, ...(tiaoHou ? [`bazi.rules.tiao_hou_${tiaoHou}`] : [])],
  };
}
/** Main-month ten god establishes the simplified pattern; rootless extreme weakness remains a warning only. */
export function detectPattern(
  pillars: BaziChart['pillars'],
  strength: BaziChart['strength'],
): BaziChart['pattern'] {
  const main = pillars.month.hiddenStems[0]!.stem;
  const god = tenGod(pillars.day.stem, main);
  const name = god === 'bi_jian' ? 'jian_lu' : god === 'jie_cai' ? 'yue_ren' : god;
  const viaStem = pillarEntries(pillars).some(([key, p]) => key !== 'day' && p.stem === main);
  // DESIGN-GAP: “极端” means score ≤−6; 根 means a hidden stem of the day-master element (not an indirect resource).
  const noRoot = !pillarEntries(pillars).some(([, p]) =>
    HIDDEN_STEMS[p.branch].some((s) => STEM_ELEMENTS[s] === pillars.day.stemElement),
  );
  return {
    name,
    viaStem,
    notes: [
      'bazi.rules.no_transformation',
      ...(strength.score <= -6 && noRoot ? ['bazi.rules.suspected_cong'] : []),
    ],
  };
}
