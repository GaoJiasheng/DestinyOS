import { evaluateWhen, type KnowledgeUnit } from '../src';
/** T-23 supplies A–G plus 500 computed charts; this checker never invents valid births. */
export function checkCoverage(
  units: KnowledgeUnit[],
  charts: unknown[],
  sections: string[],
): string[] {
  if (!charts.length) return ['Coverage requires chart fixtures'];
  return sections.flatMap((section) => {
    const missing = charts.flatMap((chart, index) =>
      units.some(
        (u) =>
          u.meta.status === 'published' &&
          u.section === section &&
          evaluateWhen(chart, u.when).matched,
      )
        ? []
        : [index],
    );
    return missing.length / charts.length > 0.01
      ? [
          `${section}: ${missing.length}/${charts.length} empty; fixture indexes ${missing.join(',')}`,
        ]
      : [];
  });
}
