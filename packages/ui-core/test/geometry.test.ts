import { describe, expect, it } from 'vitest';
import {
  compassSector,
  elementRingSegments,
  qimenPalaceOrder,
  radarPoint,
  spreadLongitudes,
  wheelPoint,
  wrap,
  ziweiPalaceCenter,
  ZIWEI_POSITIONS,
  NORTH_CELLS,
  SOUTH_CELLS,
  aspectColor,
  aspectColorToken,
  themeColors,
} from '@tianji/ui-core';

it('preserves engine labels while ring arcs close exactly, including rounded and zero snapshots', () => {
  const values = Object.freeze({ wood: 33.3, fire: 33.3, earth: 33.3, metal: 0, water: 0 });
  const arcs = elementRingSegments(values);
  expect(arcs.map((a) => a.element)).toEqual(['wood', 'fire', 'earth', 'metal', 'water']);
  expect(arcs.map((a) => a.pct)).toEqual([33.3, 33.3, 33.3, 0, 0]);
  expect(arcs.reduce((sum, a) => sum + a.length, 0)).toBeCloseTo(100);
  for (let i = 1; i < arcs.length; i++)
    expect(arcs[i]!.start).toBeCloseTo(arcs[i - 1]!.start + arcs[i - 1]!.length);
  expect(
    elementRingSegments({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }).every(
      (a) => a.length === 0 && a.start === 0,
    ),
  ).toBe(true);
});

it('retains the Web and print radar origins with clockwise axes', () => {
  expect(radarPoint(0, 90)).toEqual([150, 55]);
  expect(radarPoint(0, 90, [180, 175])).toEqual([180, 85]);
  for (let i = 0; i < 5; i++) {
    const [x, y] = radarPoint(i, 90);
    expect(Math.hypot(x - 150, y - 145)).toBeCloseTo(90);
  }
  expect(radarPoint(1, 90)[0]).toBeGreaterThan(150);
});

describe('circular collision relaxation', () => {
  it.each([
    [359, 0, 1],
    [30, 30, 30],
    [1, 7, 8, 9],
    [90, 180, 270],
  ])('separates clustered glyphs without changing true longitudes: %j', (...longitudes) => {
    const keys = ['sun', 'moon', 'mars', 'venus'] as const;
    const bodies = longitudes.map((lon, i) => Object.freeze({ key: keys[i]!, lon }));
    const original = structuredClone(bodies);
    const result = spreadLongitudes(Object.freeze(bodies));
    expect(bodies).toEqual(original);
    expect(result.map((b) => [b.key, b.lon]).sort()).toEqual(
      original.map((b) => [b.key, b.lon]).sort(),
    );
    const positions = result.map((b) => b.displayLon).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++)
      expect(wrap(positions[(i + 1) % positions.length]! - positions[i]!)).toBeGreaterThan(
        7 - 1e-6,
      );
    expect(spreadLongitudes(bodies)).toEqual(result);
  });
  it('supports empty/singleton inputs and the fixed ASC orientation', () => {
    expect(spreadLongitudes([])).toEqual([]);
    expect(spreadLongitudes([{ key: 'sun', lon: 45 }])).toEqual([
      { key: 'sun', lon: 45, displayLon: 45 },
    ]);
    expect(wheelPoint(100, 100, 100).x).toBeCloseTo(100);
    expect(wheelPoint(100, 100, 100).y).toBeCloseTo(200);
    expect(wrap(-1)).toBe(359);
  });
});

it('keeps traditional grids, all palace centers and north/south orientations', () => {
  expect(new Set(Object.values(ZIWEI_POSITIONS).map((p) => p.join(','))).size).toBe(12);
  expect(ziweiPalaceCenter('zi')).toEqual({ x: 250, y: 350 });
  expect(ziweiPalaceCenter('zi', 80)).toEqual({ x: 200, y: 280 });
  expect(NORTH_CELLS).toHaveLength(12);
  expect(SOUTH_CELLS[0]).toEqual([1, 0]);
  expect(qimenPalaceOrder(true)).toEqual([...qimenPalaceOrder(false)].reverse());
  expect(compassSector(0, true).label).toEqual({ x: 150, y: 24 });
  expect(compassSector(0, false).label.y).toBeCloseTo(284);
});

it('retains aspect CSS aliases and their native token values', () => {
  expect(aspectColor('conjunction')).toBe('var(--success)');
  expect(aspectColor('trine')).toBe('var(--element-water)');
  expect(aspectColor('sextile')).toBe('var(--element-water)');
  expect(aspectColor('square')).toBe('var(--element-fire)');
  expect(aspectColor('opposition')).toBe('var(--element-fire)');
  expect(aspectColor('quincunx')).toBe('var(--line-2)');
  expect(themeColors('west')[aspectColorToken('conjunction')]).toBe('#5FB88A');
});
