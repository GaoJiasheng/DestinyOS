import {
  PILLAR_KEYS,
  ELEMENTS,
  SIGNS,
  SIGN_GLYPHS,
  PLANET_GLYPHS,
  SOUTH_CELLS,
  NORTH_CELLS,
  vedicDivision,
  houseSign,
  wheelPoint,
  spreadLongitudes,
  aspectColorToken,
  elementRingSegments,
} from '@tianji/ui-core';
import type { AstroChart, BaziChart, VedicChart } from '@tianji/shared';
import {
  rect,
  node,
  gold,
  line,
  type Shape,
  type ChartNode,
  type ChartScene,
  type ChartLabel,
  type ChartVariant,
} from './chart-primitives';
export function baziScene(chart: BaziChart, t: ChartLabel): ChartScene {
  // DESIGN-GAP: Keep exact percentages and ages in details; compact labels use one decimal.
  const shapes: Shape[] = [],
    nodes: ChartNode[] = [];
  PILLAR_KEYS.forEach((key, index) => {
    const pillar = chart.pillars[key],
      x = index * 100;
    shapes.push(rect(x + 3, 8, 94, 168, gold));
    nodes.push(
      node(
        `pillars.${key}`,
        t(`bazi.chart.${key}`),
        pillar
          ? [
              t(`glossary.stem.${pillar.stem}.term`, pillar.stem),
              t(`glossary.branch.${pillar.branch}.term`, pillar.branch),
              t(
                pillar.tenGod === 'day_master'
                  ? 'glossary.day_master.term'
                  : `glossary.ten_god.${pillar.tenGod}.term`,
                pillar.tenGod,
              ),
            ]
          : [t('form.birth.timeUnknown')],
        pillar,
        x + 3,
        8,
        94,
        168,
      ),
    );
  });
  for (const segment of elementRingSegments(chart.elements.pct)) {
    shapes.push({
      type: 'arc',
      start: segment.start * 3.6 - 90,
      sweep: segment.length * 3.6,
      color: `wu-${segment.element}`,
    });
    const index = ELEMENTS.indexOf(segment.element);
    nodes.push(
      node(
        `elements.pct.${segment.element}`,
        t(`glossary.element.${segment.element}.term`, segment.element),
        [
          t('bazi.chart.elementValue', undefined, {
            element: t(`glossary.element.${segment.element}.term`, segment.element),
            pct: Number(segment.pct.toFixed(1)),
          }),
        ],
        {
          percent: segment.pct,
          contributions: chart.elements.contributions.filter((c) => c.element === segment.element),
        },
        210,
        192 + index * 34,
        186,
        32,
      ),
    );
  }
  shapes.push(rect(16, 394, 368, 12));
  // DESIGN-GAP: The native strength gauge uses the engine's -6..6 display range, clamped only for geometry.
  shapes.push({
    ...rect(16, 394, Math.max(0, Math.min(368, ((chart.strength.score + 6) / 12) * 368)), 12, gold),
    fill: true,
  });
  nodes.push(
    node(
      'strength',
      t('bazi.chart.strength'),
      [
        t('bazi.chart.strengthValue', undefined, {
          level: t(`glossary.strength.${chart.strength.level}.term`, chart.strength.level),
          score: chart.strength.score,
        }),
      ],
      chart.strength,
      16,
      350,
      368,
      70,
    ),
  );
  chart.luck.periods.forEach((period, i) => {
    shapes.push(rect(i * 40 + 2, 446, 36, 48, period.isCurrent ? gold : line));
    nodes.push({
      ...node(
        `luck.periods.${i}`,
        t('bazi.chart.yearRange', undefined, { from: period.fromYear, to: period.toYear }),
        [period.fromAge.toFixed(1)],
        period,
        i * 40 + 2,
        446,
        36,
        48,
      ),
      displayLabel: String(period.fromYear),
    });
  });
  return { shapes, nodes, height: 510 };
}
export function wheelScene(
  chart: AstroChart,
  t: ChartLabel,
  prefix = '',
  radius = 143,
  color = gold,
  referenceAsc = chart.angles?.asc ?? 0,
): ChartScene {
  const shapes: Shape[] = [184, 159, 120].map((r) => ({
    type: 'circle',
    x: 200,
    y: 200,
    radius: r,
    color: line,
  }));
  const nodes: ChartNode[] = [],
    asc = referenceAsc;
  SIGNS.forEach((sign, i) => {
    const a = wheelPoint(i * 30, asc, 159),
      b = wheelPoint(i * 30, asc, 184),
      p = wheelPoint(i * 30 + 15, asc, 173);
    shapes.push({ type: 'path', points: [a, b], color: line });
    nodes.push({
      ...node(
        `${prefix}sign.${sign}`,
        t(`charts.sign.${sign}`),
        [],
        { sign },
        p.x - 22,
        p.y - 10,
        44,
        24,
      ),
      point: p,
      displayLabel: t('report.content', SIGN_GLYPHS[i]),
      glyph: true,
    });
  });
  chart.houses?.forEach((house, i) => {
    const p = wheelPoint(house.cusp, asc, 159),
      inner = wheelPoint(house.cusp, asc, 55);
    shapes.push({ type: 'path', points: [inner, p], color: line });
    const middle = wheelPoint(house.cusp + 10, asc, 101);
    nodes.push({
      ...node(
        `${prefix}houses.${i}`,
        t('charts.houseNumber', undefined, { number: house.index }),
        [String(house.index)],
        house,
        middle.x - 14,
        middle.y - 14,
        28,
        28,
      ),
      point: middle,
      displayLabel: String(house.index),
      displayLines: [],
    });
  });
  chart.aspects.forEach((aspect) => {
    const a = chart.bodies.find((b) => b.key === aspect.a),
      b = chart.bodies.find((v) => v.key === aspect.b);
    if (a && b)
      shapes.push({
        type: 'path',
        points: [wheelPoint(a.lon, asc, radius * 0.69), wheelPoint(b.lon, asc, radius * 0.69)],
        color: aspectColorToken(aspect.type),
      });
  });
  spreadLongitudes(chart.bodies, 10).forEach((body) => {
    const i = chart.bodies.findIndex((b) => b.key === body.key),
      p = wheelPoint(body.displayLon, asc, radius),
      truePoint = wheelPoint(body.lon, asc, radius * 0.87);
    shapes.push(
      { type: 'path', points: [truePoint, p], color },
      { type: 'circle', x: p.x, y: p.y, radius: 4, color, fill: true },
    );
    nodes.push({
      ...node(
        `${prefix}bodies.${i}`,
        t(`charts.planet.${body.key}`),
        [chart.bodies[i]!.degInSign.toFixed(1) + '°'],
        chart.bodies[i],
        p.x - 23,
        p.y - 20,
        46,
        40,
      ),
      point: p,
      displayLabel: t('report.content', PLANET_GLYPHS[body.key]),
      glyph: true,
    });
  });
  return { shapes, nodes, height: 400 };
}
export function vedicScene(chart: VedicChart, variant: ChartVariant, t: ChartLabel): ChartScene {
  const division = vedicDivision(chart, variant.division),
    shapes: Shape[] = [],
    nodes: ChartNode[] = [];
  const north = variant.layout === 'north' && division.lagna !== null;
  SIGNS.forEach((fixedSign, i) => {
    const sign = north ? houseSign(division.lagna!, i) : fixedSign;
    const occupants = division.bodies.filter((b) => b.sign === sign);
    const path = `division.${variant.division}.sign.${sign}`;
    let target: ChartNode;
    if (north) {
      const cell = NORTH_CELLS[i]!;
      const polygon = cell.points.split(' ').map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x: x!, y: y! };
      });
      shapes.push({ type: 'path', points: polygon, color: gold, closed: true });
      target = {
        ...node(
          path,
          t(`charts.sign.${sign}`),
          occupants.map((b) => t(`charts.graha.${b.key}`, t(`charts.planet.${b.key}`, b.key))),
          { sign, house: i + 1, occupants },
          cell.x - 45,
          cell.y - 12,
          90,
          72,
        ),
        polygon,
      };
    } else {
      const [x, y] = SOUTH_CELLS[i]!;
      shapes.push(rect(x * 100, y * 100, 100, 100, gold));
      if (division.lagna === sign)
        shapes.push({
          type: 'path',
          points: [
            { x: x * 100, y: y * 100 + 28 },
            { x: x * 100 + 28, y: y * 100 },
          ],
          color: gold,
        });
      target = node(
        path,
        t(`charts.sign.${sign}`),
        occupants.map((b) => t(`charts.graha.${b.key}`, t(`charts.planet.${b.key}`, b.key))),
        { sign, occupants },
        x * 100,
        y * 100,
        100,
        100,
      );
    }
    target.related = occupants.map(
      (body) => `bodies.${chart.bodies.findIndex((b) => b.key === body.key)}`,
    );
    nodes.push(target);
  });
  chart.dasha.sequence.forEach((period, i) => {
    const x = (i * 400) / chart.dasha.sequence.length,
      width = 400 / chart.dasha.sequence.length;
    shapes.push(rect(x, 426, width, 62, period.current ? gold : line));
    nodes.push(
      node(
        `dasha.sequence.${i}`,
        t(`charts.graha.${period.lord}`, period.lord),
        [period.from.slice(0, 4), period.to.slice(0, 4)],
        period,
        x,
        426,
        width,
        62,
      ),
    );
  });
  return { shapes, nodes, height: 510 };
}
