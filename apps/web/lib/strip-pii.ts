/** Remove birth-input snapshots from chart JSON while preserving derived chart elements and offsets. */
export function stripPII(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPII);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'input' && key !== 'local')
      .map(([key, item]) => [
        key,
        // DESIGN-GAP: castAt is the divination event clock, not birth input; preserve its required local field.
        key === 'castAt' && item && typeof item === 'object' && 'local' in item
          ? { ...(stripPII(item) as Record<string, unknown>), local: item.local }
          : key === 'solarTimeAdjust' && item && typeof item === 'object' && 'original' in item
            ? {
                ...(stripPII(item) as Record<string, unknown>),
                original: '[redacted]',
                adjusted: null,
              }
            : stripPII(item),
      ]),
  );
}
