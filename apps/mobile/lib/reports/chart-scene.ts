import {
  ZIWEI_POSITIONS,
  connectedPalaces,
  qimenPalaceOrder,
  wheelPoint,
  aspectColorToken,
} from '@tianji/ui-core';
import { TAROT_SPREADS } from '@tianji/shared';
import type { NativeChart } from './readings';
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
import { baziScene, wheelScene, vedicScene } from './natal-scenes';
export * from './chart-primitives';
export * from './chart-selection';
/** Native scene descriptions reuse shared chart geometry and validated engine snapshots. Units are 400 logical chart points. */
export function makeChartScene(
  chart: NativeChart,
  t: ChartLabel,
  variant: ChartVariant,
): ChartScene {
  switch (chart.system) {
    case 'bazi':
      return baziScene(chart.data, t);
    case 'astrology':
      return wheelScene(chart.data, t);
    case 'vedic':
      return vedicScene(chart.data, variant, t);
    case 'ziwei': {
      const shapes: Shape[] = [],
        nodes: ChartNode[] = [];
      for (const palace of chart.data.palaces) {
        const [x, y] = ZIWEI_POSITIONS[palace.branch];
        shapes.push(rect(x * 100, y * 100, 100, 100, gold));
        const item = node(
          `palaces.${palace.index}`,
          t(`glossary.palace.${palace.key}.term`, palace.key),
          palace.majorStars.map((star) => t(`glossary.star.${star.key}.term`, star.key)),
          palace,
          x * 100,
          y * 100,
          100,
          100,
        );
        item.related = connectedPalaces(chart.data, palace.index).map((p) => `palaces.${p.index}`);
        nodes.push(item);
      }
      return { shapes, nodes, height: 400 };
    }
    case 'qimen': {
      const shapes: Shape[] = [],
        nodes: ChartNode[] = [];
      qimenPalaceOrder(variant.northUp).forEach((index, i) => {
        const palace = chart.data.palaces.find((p) => p.index === index)!;
        const x = (i % 3) * 133.33,
          y = Math.floor(i / 3) * 133.33;
        shapes.push(rect(x, y, 133.33, 133.33, gold));
        nodes.push(
          node(
            `palaces.${chart.data.palaces.indexOf(palace)}`,
            t(`divination.directions.${palace.direction}`, palace.direction),
            [
              t(`divination.symbols.${palace.star}`, palace.star),
              palace.gate ? t(`divination.symbols.${palace.gate}`, palace.gate) : '',
              palace.deity ? t(`divination.symbols.${palace.deity}`, palace.deity) : '',
              `${t(`glossary.stem.${palace.skyStem}.term`, palace.skyStem)} / ${t(`glossary.stem.${palace.earthStem}.term`, palace.earthStem)}`,
            ],
            palace,
            x,
            y,
            133.33,
            133.33,
          ),
        );
      });
      return { shapes, nodes, height: 400 };
    }
    case 'iching': {
      const shapes: Shape[] = [],
        nodes: ChartNode[] = [];
      const figures = [
        { key: 'primary', value: chart.data.primary },
        { key: 'changing', value: chart.data.changing },
        { key: 'mutual', value: chart.data.mutual },
      ].filter((f) => f.value);
      figures.forEach((figure, column) => {
        const hexagram = figure.value!;
        const width = 400 / figures.length,
          x = column * width + 12;
        nodes.push(
          node(
            figure.key,
            t(`glossary.hexagram.${hexagram.number}.term`, String(hexagram.number)),
            [],
            hexagram,
            x,
            8,
            width - 24,
            42,
          ),
        );
        hexagram.lines.forEach((yang, i) => {
          const y = 78 + (5 - i) * 44,
            w = width - 24;
          const moving = figure.key === 'primary' && chart.data.movingLines.includes(i + 1);
          shapes.push({
            ...rect(x, y, yang ? w : w * 0.42, 12, moving ? gold : 'text-1'),
            fill: true,
          });
          if (!yang)
            shapes.push({
              ...rect(x + w * 0.58, y, w * 0.42, 12, moving ? gold : 'text-1'),
              fill: true,
            });
          if (moving)
            shapes.push({ type: 'circle', x: x + w / 2, y: y + 6, radius: 18, color: gold });
          nodes.push({
            ...node(
              `${figure.key}.lines.${i}`,
              t('mobile.report.line', undefined, { number: i + 1 }),
              [],
              {
                yang: Boolean(yang),
                moving,
                line: chart.data.liuyao?.lines[i],
                bodyUse: chart.data.meihua,
              },
              x,
              y - 10,
              w,
              35,
            ),
            displayLabel: '',
          });
        });
      });
      return { shapes, nodes, height: 400 };
    }
    case 'tarot': {
      const shapes: Shape[] = [],
        nodes: ChartNode[] = [];
      const positions = TAROT_SPREADS[chart.data.spread];
      chart.data.cards.forEach((card, i) => {
        const p = positions[i]!,
          x = p.x * 340 - 8,
          y = p.y * 330 - 12;
        shapes.push(rect(x, y, 72, 116, gold));
        const path = `cards.${i}`;
        nodes.push({
          ...node(
            path,
            t(`glossary.${card.cardKey}.term`, card.cardKey),
            [
              t(`tarot.position.${chart.data.spread}.${card.position}.name`, card.position),
              t(card.reversed ? 'tarot.reversed' : 'tarot.upright'),
            ],
            card,
            x,
            y,
            72,
            116,
          ),
          cardKey: card.cardKey,
          rotation: p.rotation + (card.reversed ? 180 : 0),
        });
      });
      return { shapes, nodes, height: 500 };
    }
    case 'numerology': {
      const shapes: Shape[] = [],
        nodes: ChartNode[] = [];
      nodes.push(
        node(
          'lifePath',
          t('numerology.lifePath'),
          [String(chart.data.lifePath.number)],
          chart.data.lifePath,
          0,
          0,
          200,
          92,
        ),
        node(
          'birthday',
          t('numerology.birthday'),
          [String(chart.data.birthday.number)],
          chart.data.birthday,
          200,
          0,
          200,
          92,
        ),
      );
      chart.data.grid.forEach((cell, i) => {
        // DESIGN-GAP: Native uses the documented conventional 3/6/9, 2/5/8, 1/4/7 grid orientation.
        const digit = cell.digit,
          x = Math.floor((digit - 1) / 3) * 88,
          y = (2 - ((digit - 1) % 3)) * 88 + 112;
        shapes.push(rect(x, y, 88, 88));
        nodes.push({
          ...node(
            `grid.${i}`,
            String(digit),
            [t('numerology.gridCell', undefined, { digit, count: cell.count })],
            cell,
            x,
            y,
            88,
            88,
          ),
          displayLines: [String(cell.count)],
        });
      });
      shapes.push({ type: 'circle', x: 200, y: 518, radius: 104, color: line });
      (['expression', 'soul', 'personality'] as const).forEach((key, i) => {
        const value = chart.data.nameNumbers?.[key];
        nodes.push(
          node(
            `nameNumbers.${key}`,
            t(`numerology.${key}`),
            [value?.number ? String(value.number) : t('numerology.empty')],
            value ?? null,
            278,
            112 + i * 88,
            120,
            88,
          ),
        );
      });
      nodes.push(
        node(
          'personal',
          t('numerology.personalYear'),
          [
            t('numerology.personalSummary', undefined, {
              year: chart.data.personal.year,
              month: chart.data.personal.month,
              day: chart.data.personal.day,
            }),
          ],
          chart.data.personal,
          138,
          485,
          124,
          70,
        ),
      );
      chart.data.cycles.forEach((cycle, i) => {
        const point = wheelPoint((i * 360) / 9 + 90, 0, 104),
          x = point.x - 32,
          y = point.y + 294;
        shapes.push(rect(x, y, 64, 48, cycle.isCurrent ? gold : line));
        nodes.push(
          node(`cycles.${i}`, String(cycle.year), [String(cycle.number)], cycle, x, y, 64, 48),
        );
      });
      return { shapes, nodes, height: 660 };
    }
    case 'synastry': {
      const a = wheelScene(chart.data.a.astrology, t, 'a.astrology.', 144);
      const b = wheelScene(
        chart.data.b.astrology,
        t,
        'b.astrology.',
        125,
        'info',
        chart.data.a.astrology.angles?.asc ?? 0,
      );
      const shapes = [...a.shapes, ...b.shapes.filter((s) => s.color === 'info')],
        nodes = [...a.nodes, ...b.nodes.filter((n) => n.path.includes('bodies'))];
      const asc = chart.data.a.astrology.angles?.asc ?? 0;
      for (const aspect of chart.data.western.aspects) {
        const first = chart.data.a.astrology.bodies.find((v) => v.key === aspect.a)!,
          second = chart.data.b.astrology.bodies.find((v) => v.key === aspect.b)!;
        shapes.push({
          type: 'path',
          points: [wheelPoint(first.lon, asc, 114), wheelPoint(second.lon, asc, 96)],
          color: aspectColorToken(aspect.type),
        });
      }
      chart.data.ashtakoot.kootas.forEach((koota, i) => {
        const x = (i % 4) * 100,
          y = 422 + Math.floor(i / 4) * 68;
        shapes.push(rect(x, y, 100, 68));
        nodes.push(
          node(
            `ashtakoot.kootas.${i}`,
            t(`synastry.koota.${koota.key}`, koota.key),
            [`${koota.score} / ${koota.max}`],
            koota,
            x,
            y,
            100,
            68,
          ),
        );
      });
      return { shapes, nodes, height: 570 };
    }
  }
}
