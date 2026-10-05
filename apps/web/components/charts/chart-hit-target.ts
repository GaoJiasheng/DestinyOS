/** Resolve overlapping chart hit areas to the nearest visible glyph in the same SVG. */
export function closestBodyKey<T extends string>(
  target: SVGGElement,
  point: { x: number; y: number },
  keys: readonly T[],
  fallback: T,
): T {
  // DESIGN-GAP: Dense planet groups share enlarged touch areas; choose the nearest glyph instead of whichever transparent area was painted last.
  const candidates = Array.from(
    target.ownerSVGElement?.querySelectorAll<SVGGElement>('g[data-body]') ?? [],
  )
    .flatMap((group) => {
      const area = group.querySelector<SVGElement>('.chart-hit-target');
      const rect = area?.getBoundingClientRect();
      if (
        !rect?.width ||
        !rect.height ||
        point.x < rect.left ||
        point.x > rect.right ||
        point.y < rect.top ||
        point.y > rect.bottom
      )
        return [];
      return [
        {
          key: group.dataset.body,
          distance: Math.hypot(
            point.x - rect.left - rect.width / 2,
            point.y - rect.top - rect.height / 2,
          ),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
  return keys.find((key) => key === candidates[0]?.key) ?? fallback;
}
