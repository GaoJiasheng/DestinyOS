export interface Point {
  x: number;
  y: number;
}
export type Shape =
  | {
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      fill?: boolean;
    }
  | { type: 'circle'; x: number; y: number; radius: number; color: string; fill?: boolean }
  | { type: 'path'; points: Point[]; color: string; closed?: boolean; fill?: boolean }
  | { type: 'arc'; start: number; sweep: number; color: string };
export interface ChartNode {
  path: string;
  label: string;
  displayLabel?: string;
  displayLines?: string[];
  glyph?: boolean;
  lines: string[];
  detail: unknown;
  bounds: { x: number; y: number; width: number; height: number };
  polygon?: Point[];
  point?: Point;
  related?: string[];
  cardKey?: import('@tianji/shared').TarotChart['cards'][number]['cardKey'];
  rotation?: number;
}
export interface ChartScene {
  shapes: Shape[];
  nodes: ChartNode[];
  height: number;
}
export type ChartLabel = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;
export interface ChartVariant {
  division: 'D1' | 'D9';
  layout: 'south' | 'north';
  northUp: boolean;
}
export const gold = 'gold',
  line = 'line-2';
/** Native rectangular grid cell in logical chart points. */
export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  color = line,
): Extract<Shape, { type: 'rect' }> {
  return { type: 'rect', x, y, width, height, color };
}
/** Accessible chart target in the same coordinates used by Skia and hit testing. */
export function node(
  path: string,
  label: string,
  lines: string[],
  detail: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
): ChartNode {
  return { path, label, lines, detail, bounds: { x, y, width, height } };
}
