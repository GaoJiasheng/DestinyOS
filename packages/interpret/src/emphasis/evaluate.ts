import type { CompiledScoringRule, CompiledScoringRules, Dim } from '@tianji/content';
import { ziweiScoringRules } from '@tianji/content/scoring/ziwei-rules';
import { ZiweiChartSchema } from '@tianji/shared';
import type {
  Emphasis,
  EmphasisBasis,
  EmphasisDimension,
  EmphasisLevel,
  EmphasisSupport,
} from './types';
import { ziweiScoringView, type ZiweiScoringTarget, type ZiweiScoringView } from './ziwei-view';
type Hit = { units: number; params: Record<string, string> };
/** Integer-unit hits of one rule against one target palace; empty when it does not fire. */
function apply(
  rule: CompiledScoringRule,
  target: ZiweiScoringTarget,
  scale: CompiledScoringRules['brightnessScale'],
): Hit[] {
  const { self } = target;
  if (rule.gate === 'occupied' && self.empty) return [];
  if (rule.gate === 'empty' && !self.empty) return [];
  const m = rule.measure;
  const source = m.from === 'self' ? self : target.opposite;
  const base: Record<string, string> = { palace: self.palace };
  if (m.from === 'opposite') base.opposite = target.opposite.palace;
  if (m.kind === 'brightness') {
    if (!source.majorStars.length) return [];
    const sum = source.majorStars.reduce((total, star) => total + scale[star.brightness], 0);
    const units = (sum * m.factor) / source.majorStars.length;
    // Validation enumerates every one- and two-star average, so a fraction means a corrupt table.
    if (!Number.isInteger(units)) throw new Error(`Fractional emphasis units in ${rule.id}`);
    return [
      {
        units,
        params: {
          ...base,
          stars: source.majorStars.map((s) => s.key).join(','),
          brightness: source.majorStars.map((s) => s.brightness).join(','),
        },
      },
    ];
  }
  if (m.kind === 'mutagen')
    return source.mutagens.flatMap(({ star, mutagen }) => {
      const units = m.deltas[mutagen];
      return units === undefined ? [] : [{ units, params: { ...base, star, mutagen } }];
    });
  if (m.kind === 'stars') {
    const hits = m.keys.filter(
      (key) =>
        source.stars.some((s) => s === key) &&
        (!m.brightness || m.brightness.some((b) => b === source.brightnessOf[key])),
    );
    if (!hits.length) return [];
    return [
      { units: m.once ?? (m.each ?? 0) * hits.length, params: { ...base, stars: hits.join(',') } },
    ];
  }
  const has = (key: string) =>
    key.startsWith('mutagen:')
      ? source.mutagens.some((t) => `mutagen:${t.mutagen}` === key)
      : source.stars.some((s) => s === key);
  if (!m.all.every(has) || !m.any.some(has)) return [];
  const stars = [...m.all, ...m.any].filter((key) => !key.startsWith('mutagen:') && has(key));
  return [{ units: m.delta, params: { ...base, stars: stars.join(',') } }];
}
/** Clamp a running group total toward its one-sided cap. */
const bound = (cap: number, value: number) =>
  cap > 0 ? Math.min(cap, value) : Math.max(cap, value);
/** Score one view with a compiled rule table: group caps, clamp, then cutpoint bands (§5.1). */
export function evaluateEmphasis(view: ZiweiScoringView, rules: CompiledScoringRules): Emphasis {
  const ordered = [...rules.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const dims: Partial<Record<Dim, EmphasisDimension>> = {};
  for (const dim of rules.dims) {
    const target = view[dim];
    if (!target) throw new Error(`Emphasis view lacks ${dim}`);
    const groups = new Map<string, number>();
    const basis: EmphasisBasis[] = [];
    let total = 0;
    for (const rule of ordered) {
      if (rule.dims && !rule.dims.includes(dim)) continue;
      for (const hit of apply(rule, target, rules.brightnessScale)) {
        let units = hit.units;
        const cap = rule.group === undefined ? undefined : rules.groups[rule.group]?.cap;
        if (rule.group !== undefined && cap !== undefined) {
          const before = groups.get(rule.group) ?? 0;
          const after = bound(cap, before + units);
          groups.set(rule.group, after);
          units = after - before;
        }
        // Brightness is shown even at zero (it explains a flat dimension); other rules only when they move it.
        if (units === 0 && rule.measure.kind !== 'brightness') continue;
        basis.push({ ruleId: rule.id, delta: units / rules.unit, params: hit.params });
        total += units;
      }
    }
    const clamped = Math.max(-rules.clamp, Math.min(rules.clamp, total));
    const band = rules.cutpoints.filter((cut) => clamped >= cut).length;
    dims[dim] = { level: (2 + band) as EmphasisLevel, raw: clamped / rules.unit, basis };
  }
  const top = rules.dims
    .filter((dim) => (dims[dim]?.level ?? 0) >= 4)
    .map((dim, order) => ({ dim, order, raw: dims[dim]?.raw ?? 0 }))
    .sort((a, b) => b.raw - a.raw || a.order - b.order)
    .slice(0, 2)
    .map((entry) => entry.dim);
  return { version: rules.scoringVersion, dims, top, omitted: [...rules.omitted] };
}
/** Chart emphasis for a Zi Wei report, from the frozen scoring table.
 * @param chart Engine Zi Wei chart; anything else is rejected rather than scored. */
export function ziweiEmphasis(chart: unknown): Emphasis {
  const parsed = ZiweiChartSchema.safeParse(chart);
  if (!parsed.success) throw new Error('Chart emphasis requires a valid Zi Wei chart');
  return evaluateEmphasis(
    ziweiScoringView(parsed.data, ziweiScoringRules.palaceOf),
    ziweiScoringRules,
  );
}
/** Headline fragment for interpret: `{}` unless emphasis was requested and the system offers it,
 * so reports produced with the switch off keep their exact previous shape. */
export function emphasisField(
  support: EmphasisSupport,
  chart: unknown,
  enabled: boolean | undefined,
): { emphasis?: Emphasis } {
  return enabled && support.status === 'available' ? { emphasis: support.compute(chart) } : {};
}
