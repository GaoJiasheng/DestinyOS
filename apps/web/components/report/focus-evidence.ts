import { chartPath, focusChartAnchor, isHighlighted } from '../charts/bazi-shared';
type ChartNode = HTMLElement | SVGElement;
/** Open a folded report section so anchor navigation never lands on hidden content. */
export function openSection(key: string) {
  const fold = document.querySelector<HTMLDetailsElement>(`#section-${key} details.section-fold`);
  if (fold) fold.open = true;
}
/** Pick the most specific rendered node for a chart path within one scope. */
function bestMatch(scope: ParentNode, resolved: string): ChartNode | undefined {
  const candidates = Array.from(scope.querySelectorAll<ChartNode>('[data-chart-path]'))
    .filter((element) => isHighlighted(resolved, element.dataset.chartPath ?? ''))
    .sort((a, b) => (b.dataset.chartPath?.length ?? 0) - (a.dataset.chartPath?.length ?? 0));
  return (
    candidates.find((element) => chartPath(element.dataset.chartPath ?? '') === resolved) ??
    candidates[0]
  );
}
/** Focus the most specific rendered chart node for resolved evidence, expanding its disclosure first.
 * The main chart wins; a chart reference inside another folded report topic is the fallback.
 * @param resolved Canonical snapshot chart path selected by the report renderer.
 */
export function focusEvidence(resolved: string): void {
  const root = document.getElementById('chart-root');
  const details = root?.closest('details');
  if (details) details.open = true;
  // DESIGN-GAP: Evidence paths can point inside arrays; choose the most specific rendered parent and fall back to the chart root.
  requestAnimationFrame(() => {
    const target = (root ? bestMatch(root, resolved) : undefined) ?? bestMatch(document, resolved);
    const fold = target?.closest<HTMLDetailsElement>('details.section-fold');
    if (fold) fold.open = true;
    focusChartAnchor(target ?? root);
  });
}
