import type { BaziChart } from '@tianji/shared';
import { PILLAR_KEYS } from '@tianji/ui-core';
export { PILLAR_KEYS, ELEMENTS } from '@tianji/ui-core';
import { parsePath } from '@tianji/content';

export type BaziChartProps = {
  chart: BaziChart;
  highlight?: string;
  onSelect?: (path: string) => void;
};

/** Normalize interpretation paths, including array indices, to chart-relative dot paths. */
export function chartPath(path: string): string {
  return path.replace(/^bazi\./, '').replace(/\[([^\]]+)\]/g, '.$1');
}

/** Resolve knowledge-base filters/wildcards to concrete snapshot paths for report-to-chart anchors. */
export function resolveChartPaths(chart: unknown, path: string): string[] {
  const relative = path.replace(/^bazi\./, '');
  if (!relative.includes('=') && !relative.includes('*')) return [chartPath(relative)];
  let nodes: Array<{ value: unknown; path: string }> = [{ value: chart, path: '' }];
  try {
    for (const token of parsePath(relative)) {
      nodes = nodes.flatMap((node) => {
        const value = node.value;
        if (value === null || typeof value !== 'object') return [];
        const entries = Object.entries(value);
        if (token.kind === 'property') {
          const match = entries.find(([key]) => key === token.key);
          return match
            ? [{ value: match[1], path: node.path ? `${node.path}.${match[0]}` : match[0] }]
            : [];
        }
        if (token.kind === 'wildcard')
          return entries.map(([key, item]) => ({ value: item, path: `${node.path}.${key}` }));
        const candidates = Array.isArray(value)
          ? entries.map(([key, item]) => ({ value: item, path: `${node.path}.${key}` }))
          : [node];
        return candidates.filter(
          (candidate) =>
            candidate.value !== null &&
            typeof candidate.value === 'object' &&
            Object.entries(candidate.value).some(
              ([key, item]) => key === token.key && item === token.value,
            ),
        );
      });
    }
    return nodes.map((node) => node.path);
  } catch {
    return [chartPath(relative)];
  }
}

/** Include the natal pillars implicated by relation, special-marker and void evidence. */
export function highlightedPillars(chart: BaziChart, highlight?: string): string[] {
  if (!highlight) return [];
  const path = chartPath(highlight);
  const relation = path.match(/^relations\.(branches|stems)\.(\d+)(?:\.|$)/);
  if (relation)
    return (
      (relation[1] === 'branches' ? chart.relations.branches : chart.relations.stems)[
        Number(relation[2])
      ]?.pillars ?? []
    );
  const marker = path.match(/^shenSha\.(\d+)(?:\.|$)/);
  if (marker) return chart.shenSha[Number(marker[1])]?.hitsPillar ?? [];
  if (path.startsWith('voidBranches'))
    return PILLAR_KEYS.filter((key) => chart.pillars[key]?.isVoid);
  return [];
}

/** Match a chart field or its parent, without confusing similarly named pillars or indices. */
export function isHighlighted(highlight: string | undefined, path: string): boolean {
  if (!highlight) return false;
  const h = chartPath(highlight);
  const p = chartPath(path);
  return h === p || h.startsWith(`${p}.`) || p.startsWith(`${h}.`);
}

/** Choose the documented report chapter for a selected chart field. */
export function baziSection(path: string): string {
  const p = chartPath(path);
  if (/^(luck|years|months)(\.|$)/.test(p)) return 'luck_timeline';
  if (/^(elements|strength|useGod)(\.|$)/.test(p)) return 'elements';
  if (/^(shenSha|voidBranches|relations)(\.|$)/.test(p)) return 'shensha_notes';
  if (p.startsWith('pattern')) return 'pattern_career';
  if (p.startsWith('dayMaster') || p.startsWith('pillars.day')) return 'day_master';
  return 'overview';
}

/** Scroll and focus an anchor while honoring the operating system's reduced-motion preference. */
export function focusChartAnchor(target: HTMLElement | SVGElement | null): void {
  if (!target) return;
  const reduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.reducedMotion === 'true';
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  target.focus({ preventScroll: true });
}
