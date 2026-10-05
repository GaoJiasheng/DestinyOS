import { chartPath, focusChartAnchor, isHighlighted } from '../charts/bazi-shared';
/** Focus the most specific rendered chart node for resolved evidence, expanding its disclosure first.
 * @param resolved Canonical snapshot chart path selected by the report renderer.
 */
export function focusEvidence(resolved: string): void {
  const root = document.getElementById('chart-root');
  if (!root) return;
  const details = root.closest('details');
  if (details) details.open = true;
  // DESIGN-GAP: Evidence paths can point inside arrays; choose the most specific rendered parent and fall back to the chart root.
  requestAnimationFrame(() => {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement | SVGElement>('[data-chart-path]'),
    )
      .filter((element) => isHighlighted(resolved, element.dataset.chartPath ?? ''))
      .sort((a, b) => (b.dataset.chartPath?.length ?? 0) - (a.dataset.chartPath?.length ?? 0));
    const exact = candidates.find(
      (element) => chartPath(element.dataset.chartPath ?? '') === resolved,
    );
    focusChartAnchor(exact ?? candidates[0] ?? root);
  });
}
