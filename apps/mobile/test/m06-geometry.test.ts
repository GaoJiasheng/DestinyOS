import { compute, normalizeBirth } from '@tianji/engine';
import { interpret } from '@tianji/interpret';
import { TAROT_SPREADS } from '@tianji/shared';
import { NORTH_CELLS, ZIWEI_POSITIONS } from '@tianji/ui-core';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../packages/engine/test/fixtures/birth/B.json';
import { bundledKnowledge } from '../lib/knowledge/bundled';
import { parseNativeChart, reportSystems, type ReportSystem } from '../lib/reports/readings';
import {
  chartPoint,
  hitChart,
  makeChartScene,
  nodesForEvidence,
  sectionForNode,
  type ChartVariant,
} from '../lib/reports/chart-scene';
const now = '2026-10-04T04:00:00Z';
const variant: ChartVariant = { division: 'D1', layout: 'south', northUp: false };
const label = (key: string, fallback?: string) => fallback ?? key;
function fixture(system: ReportSystem) {
  return parseNativeChart(
    system,
    compute({
      system,
      now,
      seed: 'fixture-A',
      birth: normalizeBirth(A),
      partnerBirth: system === 'synastry' ? normalizeBirth(B) : undefined,
    }).chart,
  );
}
for (const system of reportSystems) {
  test(`${system}: validates engine data, draws bounded geometry and links real report evidence`, () => {
    const chart = fixture(system),
      scene = makeChartScene(chart, label, variant);
    expect(scene.nodes.length).toBeGreaterThan(0);
    expect(new Set(scene.nodes.map((n) => n.path)).size).toBe(scene.nodes.length);
    for (const n of scene.nodes) {
      expect(n.bounds.x).toBeGreaterThanOrEqual(-1);
      expect(n.bounds.x + n.bounds.width).toBeLessThanOrEqual(401);
      expect(n.bounds.y + n.bounds.height).toBeLessThanOrEqual(scene.height);
    }
    const report = interpret({
      system,
      chart: chart.data,
      locale: 'zh',
      knowledge: bundledKnowledge(),
      context: { now, profileHasTime: true },
    });
    const evidence = report.sections.flatMap((s) =>
      s.blocks.flatMap((b) => (b.type === 'evidence' ? b.items : [])),
    );
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => nodesForEvidence(chart, scene, e.path).length > 0)).toBe(true);
    const n = scene.nodes.find((item) => item.path.includes('bodies')) ?? scene.nodes[0]!;
    expect(report.sections.map((s) => s.key)).toContain(sectionForNode(report, chart, scene, n));
    expect(nodesForEvidence(chart, scene, 'nonexistent')).toEqual([]);
  });
}
test('chart hit tests invert pinch and pan rather than selecting a neighboring palace', () => {
  const chart = fixture('qimen'),
    scene = makeChartScene(chart, label, variant);
  const node = scene.nodes[0]!;
  const chartX = node.bounds.x + 20,
    chartY = node.bounds.y + 20,
    width = 320,
    height = 320,
    zoom = 2,
    dx = 45,
    dy = -20;
  const x = ((chartX * width) / 400 - width / 2) * zoom + width / 2 + dx;
  const y = ((chartY * width) / 400 - height / 2) * zoom + height / 2 + dy;
  expect(hitChart(scene, chartPoint(x, y, width, height, zoom, dx, dy))?.path).toBe(node.path);
  expect(hitChart(scene, { x: -100, y: -100 })).toBeUndefined();
});
test('filtered body and named palace evidence resolves the saved chart, including D9 cells', () => {
  const astrology = fixture('astrology');
  if (astrology.system !== 'astrology') throw new Error('fixture');
  const scene = makeChartScene(astrology, label, variant);
  const sun = astrology.data.bodies.findIndex((b) => b.key === 'sun');
  expect(nodesForEvidence(astrology, scene, 'bodies[key=sun].sign').map((n) => n.path)).toContain(
    `bodies.${sun}`,
  );
  const ziwei = fixture('ziwei');
  if (ziwei.system !== 'ziwei') throw new Error('fixture');
  const life = ziwei.data.palaces.find((p) => p.key === 'life')!;
  const z = makeChartScene(ziwei, label, variant);
  expect(nodesForEvidence(ziwei, z, 'palaces[key=life].majorStars').map((n) => n.path)).toContain(
    `palaces.${life.index}`,
  );
  expect(z.nodes.find((n) => n.path === `palaces.${life.index}`)?.bounds.x).toBe(
    ZIWEI_POSITIONS[life.branch][0] * 100,
  );
  const vedic = fixture('vedic');
  const d9 = makeChartScene(vedic, label, { ...variant, division: 'D9', layout: 'north' });
  expect(d9.nodes.filter((n) => n.polygon)).toHaveLength(NORTH_CELLS.length);
  expect(nodesForEvidence(vedic, d9, 'bodies[key=chandra].nakshatra')).toHaveLength(1);
});
test('unknown time never invents houses, North Indian Lagna or an hour pillar', () => {
  const birth = normalizeBirth({ ...A, timeUnknown: true, hour: undefined, minute: undefined });
  for (const system of ['bazi', 'astrology', 'vedic'] as const) {
    const chart = parseNativeChart(system, compute({ system, birth, now }).chart);
    const scene = makeChartScene(chart, label, { ...variant, layout: 'north' });
    if (chart.system === 'bazi') expect(chart.data.pillars.hour).toBeNull();
    if (chart.system === 'astrology')
      expect(scene.nodes.some((n) => n.path.startsWith('houses'))).toBe(false);
    if (chart.system === 'vedic') expect(scene.nodes.some((n) => n.polygon)).toBe(false);
  }
});
test('all eight tarot layouts retain shared coordinates, unique positions and upright crossing cards', () => {
  for (const spread of Object.keys(TAROT_SPREADS) as (keyof typeof TAROT_SPREADS)[]) {
    const chart = parseNativeChart(
      'tarot',
      compute({ system: 'tarot', spread, now, seed: 'M06-spreads', allowReversed: true }).chart,
    );
    const scene = makeChartScene(chart, label, variant);
    expect(scene.nodes).toHaveLength(TAROT_SPREADS[spread].length);
    expect(scene.nodes.map((n) => n.path)).toEqual(
      TAROT_SPREADS[spread].map((_, i) => `cards.${i}`),
    );
  }
});
