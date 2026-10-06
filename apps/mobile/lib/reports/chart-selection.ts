import { resolvePath } from '@tianji/content';
import type { Report } from '@tianji/interpret';
import type { NativeChart } from './readings';
import type { Point, ChartNode, ChartScene } from './chart-primitives';
function objectValue(value: unknown) {
  return value && typeof value === 'object' ? value : null;
}
/** Resolve numeric and filtered knowledge paths to visible nodes; never match unrelated value text. */
export function nodesForEvidence(chart: NativeChart, scene: ChartScene, path: string): ChartNode[] {
  if (!path) return [];
  const normalized = path.replace(/^chart\./, '').replace(/\[(\d+)\]/g, '.$1');
  const direct = scene.nodes.filter(
    (n) =>
      normalized === n.path ||
      normalized.startsWith(n.path + '.') ||
      n.path.startsWith(normalized + '.') ||
      (chart.system === 'vedic' &&
        n.related?.some((p) => normalized === p || normalized.startsWith(p + '.'))),
  );
  if (direct.length) return direct;
  // Use the shared JSONPath-lite resolver for KU selectors such as bodies[key=sun].sign.
  for (const root of [
    'palaces',
    'bodies',
    'cards',
    'houses',
    'grid',
    'cycles',
    'dasha.sequence',
    'a.astrology.bodies',
    'b.astrology.bodies',
    'ashtakoot.kootas',
  ]) {
    if (!normalized.startsWith(root + '[')) continue;
    const end = normalized.indexOf(']', root.length);
    const matched = resolvePath(chart.data, normalized.slice(0, end + 1));
    const values = resolvePath(chart.data, root)[0];
    if (!Array.isArray(values)) continue;
    const paths = values.flatMap((v: unknown, i: number) =>
      matched.includes(v) ? [`${root}.${i}`] : [],
    );
    const selected = scene.nodes.filter((n) =>
      paths.some((p) => n.path === p || (chart.system === 'vedic' && n.related?.includes(p))),
    );
    if (selected.length) return selected;
  }
  if (chart.system === 'bazi') {
    if (normalized.startsWith('dayMaster'))
      return scene.nodes.filter((n) => n.path === 'pillars.day');
    if (normalized.startsWith('relations') || normalized.startsWith('shenSha')) {
      const objects = resolvePath(chart.data, normalized.replace(/\.[^.]+$/, '')).map(objectValue);
      const pillars = objects
        .flatMap((o) =>
          o && ('pillars' in o || 'hitsPillar' in o)
            ? 'pillars' in o
              ? o.pillars
              : 'hitsPillar' in o
                ? o.hitsPillar
                : []
            : [],
        )
        .filter((v): v is string => typeof v === 'string');
      return scene.nodes.filter((n) => pillars.some((p) => n.path === `pillars.${p}`));
    }
  }
  if (chart.system === 'vedic' && normalized.startsWith('moon'))
    return scene.nodes.filter((n) =>
      n.related?.includes(`bodies.${chart.data.bodies.findIndex((b) => b.key === 'chandra')}`),
    );
  // DESIGN-GAP: Aggregate evidence (distribution, patterns, flags) refers to the complete
  // saved chart; illuminate its visible nodes rather than choosing an arbitrary palace.
  return resolvePath(chart.data, normalized).length ? scene.nodes : [];
}
/** Find the report chapter whose evidence points at a selected chart element. */
export function sectionForNode(
  report: Report,
  chart: NativeChart,
  scene: ChartScene,
  selected: ChartNode,
): string {
  return (
    report.sections.find((s) =>
      s.blocks.some(
        (block) =>
          block.type === 'evidence' &&
          block.items.some((item) =>
            (() => {
              const matched = nodesForEvidence(chart, scene, item.path);
              return (
                matched.length < scene.nodes.length && matched.some((n) => n.path === selected.path)
              );
            })(),
          ),
      ),
    )?.key ??
    report.sections[0]?.key ??
    'overview'
  );
}
/** Invert a centered zoom/pan transform for hit testing, in logical chart coordinates. */
export function chartPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  dx: number,
  dy: number,
): Point {
  return {
    x: (((x - width / 2 - dx) / scale + width / 2) * 400) / width,
    y: (((y - height / 2 - dy) / scale + height / 2) * 400) / width,
  };
}
function containsPolygon(polygon: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
/** Prefer small planet targets over overlapping houses; North Indian hits use true polygons. */
export function hitChart(scene: ChartScene, point: Point): ChartNode | undefined {
  return [...scene.nodes]
    .reverse()
    .find((n) =>
      n.polygon
        ? containsPolygon(n.polygon, point)
        : point.x >= n.bounds.x &&
          point.x <= n.bounds.x + n.bounds.width &&
          point.y >= n.bounds.y &&
          point.y <= n.bounds.y + n.bounds.height,
    );
}
