import type { Dim } from '@tianji/content';
import type { Branch, Brightness, Mutagen, Palace, StarKey, ZiweiChart } from '@tianji/shared';
/** 六吉 */
export const ZIWEI_LUCKY_STARS: readonly StarKey[] = [
  'zuo_fu',
  'you_bi',
  'wen_chang',
  'wen_qu',
  'tian_kui',
  'tian_yue',
];
/** 六煞 */
export const ZIWEI_MALEFIC_STARS: readonly StarKey[] = [
  'qing_yang',
  'tuo_luo',
  'huo_xing',
  'ling_xing',
  'di_kong',
  'di_jie',
];
/** Scoring-relevant facts of one palace, in the chart's own star order. */
export type ZiweiPalaceFacts = {
  palace: Palace;
  index: number;
  branch: Branch;
  /** No major star: tradition borrows the opposite palace's major stars. */
  empty: boolean;
  majorStars: { key: StarKey; brightness: Brightness }[];
  /** Birth-year transformations on any star in this palace (major or minor). */
  mutagens: { star: StarKey; mutagen: Mutagen }[];
  lucky: StarKey[];
  malefic: StarKey[];
  luCun: boolean;
  tianMa: boolean;
  /** Every major and minor star key, majors first. */
  stars: StarKey[];
  /** Brightness of each star that carries one (minor stars may too). */
  brightnessOf: Partial<Record<string, Brightness>>;
};
export type ZiweiScoringTarget = { self: ZiweiPalaceFacts; opposite: ZiweiPalaceFacts };
export type ZiweiScoringView = Partial<Record<Dim, ZiweiScoringTarget>>;
function facts(palace: ZiweiChart['palaces'][number]): ZiweiPalaceFacts {
  const all = [...palace.majorStars, ...palace.minorStars];
  const stars = all.map((s) => s.key);
  return {
    palace: palace.key,
    index: palace.index,
    branch: palace.branch,
    empty: palace.majorStars.length === 0,
    majorStars: palace.majorStars.map((s) => ({ key: s.key, brightness: s.brightness })),
    mutagens: all.flatMap((s) => (s.mutagen ? [{ star: s.key, mutagen: s.mutagen }] : [])),
    lucky: stars.filter((key) => ZIWEI_LUCKY_STARS.includes(key)),
    malefic: stars.filter((key) => ZIWEI_MALEFIC_STARS.includes(key)),
    luCun: stars.includes('lu_cun'),
    tianMa: stars.includes('tian_ma'),
    stars,
    brightnessOf: Object.fromEntries(
      all.flatMap((s) => (s.brightness ? [[s.key, s.brightness] as const] : [])),
    ),
  };
}
/** Collect each target palace and its opposite (index + 6 mod 12) for the emphasis rules.
 * @param chart Engine Zi Wei chart; palaces are addressed by their `index`, not array position.
 * @param palaceOf Dimension → target palace key, from the scoring table. */
export function ziweiScoringView(
  chart: ZiweiChart,
  palaceOf: Partial<Record<Dim, string>>,
): ZiweiScoringView {
  const byIndex = new Map(chart.palaces.map((p) => [p.index, p]));
  const view: ZiweiScoringView = {};
  for (const [dim, key] of Object.entries(palaceOf) as [Dim, string][]) {
    const self = chart.palaces.find((p) => p.key === key);
    const opposite = self && byIndex.get((self.index + 6) % 12);
    if (!self || !opposite) throw new Error(`Zi Wei chart lacks palace ${key} or its opposite`);
    view[dim] = { self: facts(self), opposite: facts(opposite) };
  }
  return view;
}
