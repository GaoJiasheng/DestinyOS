/** Check the existing print-ready/error sentinel inside either browser adapter. */
export function printSettled(): boolean {
  // DESIGN-GAP: Wait for streaming's hidden report copy to disappear before counting sheets or producing binary exports.
  const reports = document.querySelectorAll('.print-report');
  if (reports.length !== 1) return false;
  return ['true', 'error'].includes(reports[0]?.getAttribute('data-ready') ?? '');
}
/** Scale the report to the existing 2480px, 300-DPI A4 screenshot width.
 * @param node Print-report root evaluated inside the browser page.
 */
export function zoomPrintReport(node: Element): void {
  (node as HTMLElement).style.zoom = String(2480 / ((210 * 96) / 25.4));
}
/** Display only the selected print sheet and reset the screenshot scroll position.
 * @param nodes Ordered print sheets evaluated inside the browser page.
 * @param selected Zero-based sheet index.
 */
export function selectPrintSheet(nodes: Element[], selected: number): void {
  nodes.forEach((node, i) => {
    (node as HTMLElement).style.display = i === selected ? '' : 'none';
  });
  window.scrollTo(0, 0);
}
