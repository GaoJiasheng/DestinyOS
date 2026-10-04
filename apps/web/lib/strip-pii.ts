/** Remove birth-input snapshots from chart JSON while preserving derived chart elements and offsets. */
export function stripPII(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPII);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'input' && key !== 'local')
      .map(([key, item]) => [key, stripPII(item)]),
  );
}
