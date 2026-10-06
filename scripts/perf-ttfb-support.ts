/** Nearest-rank P75 in milliseconds; ten samples select the eighth observation. */
export function p75(samples: number[]): number {
  if (!samples.length || samples.some((sample) => !Number.isFinite(sample) || sample < 0))
    throw new Error('Invalid TTFB samples');
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.75) - 1]!;
}
/** Fail on bad HTTP responses as well as latency regressions. */
export function assertTtfbBudget(
  samples: { ttfbMs: number; status: number }[],
  budgetMs: number,
): number {
  if (samples.length !== 10 || samples.some((sample) => sample.status !== 200))
    throw new Error('TTFB check requires ten successful responses');
  const observed = p75(samples.map((sample) => sample.ttfbMs));
  if (observed > budgetMs)
    throw new Error(`TTFB P75 ${observed.toFixed(1)}ms exceeds ${budgetMs}ms`);
  return observed;
}
