import { Element, type Branch, type PillarKey } from '@tianji/shared';
import { ZIWEI_POSITIONS } from './ziwei-geometry';

export const PILLAR_KEYS: readonly PillarKey[] = ['year', 'month', 'day', 'hour'];
export const BRANCH_RELATION_POINTS = {
  year: [150, 40],
  month: [260, 150],
  day: [150, 260],
  hour: [40, 150],
} as const;

export const ELEMENTS = Object.values(Element);
export const SCORE_DIMENSIONS = ['career', 'wealth', 'love', 'health', 'social'] as const;

/** Ring proportions in path-length units (100); preserve the snapshot percentages for labels. */
export function elementRingSegments(percentages: Readonly<Record<Element, number>>) {
  let offset = 0;
  const total = ELEMENTS.reduce((sum, element) => sum + percentages[element], 0);
  return ELEMENTS.map((element) => {
    const pct = percentages[element];
    // DESIGN-GAP: Normalize rounded engine percentages only for arc geometry; labels preserve the snapshot values.
    const length = total > 0 ? (pct / total) * 100 : 0;
    const start = offset;
    offset += length;
    return { element, pct, length, start };
  });
}

/** Five-dimension radar coordinates in chart units, starting at twelve o'clock clockwise. */
export function radarPoint(
  index: number,
  radius: number,
  center: readonly [number, number] = [150, 145],
): [number, number] {
  return [
    center[0] + Math.sin((index * 2 * Math.PI) / 5) * radius,
    center[1] - Math.cos((index * 2 * Math.PI) / 5) * radius,
  ];
}

/** Palace center in chart units; the Web view box uses 100 units per cell. */
export function ziweiPalaceCenter(branch: Branch, cellSize = 100) {
  const [x, y] = ZIWEI_POSITIONS[branch];
  return { x: x * cellSize + cellSize / 2, y: y * cellSize + cellSize / 2 };
}

/** Traditional Lo Shu palace order, read left-to-right/top-to-bottom with the requested orientation. */
export function qimenPalaceOrder(northUp: boolean): readonly number[] {
  return northUp ? [6, 1, 8, 7, 5, 3, 2, 9, 4] : [4, 9, 2, 3, 5, 7, 8, 1, 6];
}

/** Compass sector endpoints and label point in the original 300-unit chart. */
export function compassSector(index: number, northUp: boolean) {
  const angle = ((index * 45 + (northUp ? 0 : 180)) * Math.PI) / 180;
  const start = angle - Math.PI / 8;
  const end = angle + Math.PI / 8;
  return {
    start: { x: 150 + 110 * Math.sin(start), y: 150 - 110 * Math.cos(start) },
    end: { x: 150 + 110 * Math.sin(end), y: 150 - 110 * Math.cos(end) },
    label: { x: 150 + 130 * Math.sin(angle), y: 154 - 130 * Math.cos(angle) },
  };
}
