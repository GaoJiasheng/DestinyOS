import { expect, it } from 'vitest';
import { p75, assertTtfbBudget } from './perf-ttfb-support';
it('uses nearest-rank P75 and rejects latency, HTTP, sample-count and numeric regressions', () => {
  expect(p75([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])).toBe(8);
  const samples = Array.from({ length: 10 }, (_, i) => ({ ttfbMs: (i + 1) * 40, status: 200 }));
  expect(assertTtfbBudget(samples, 320)).toBe(320);
  expect(() => assertTtfbBudget(samples, 300)).toThrow('exceeds');
  expect(() =>
    assertTtfbBudget([...samples.slice(0, 9), { ttfbMs: 1, status: 503 }], 1000),
  ).toThrow('successful');
  expect(() => assertTtfbBudget(samples.slice(1), 1000)).toThrow();
  expect(() => p75([NaN])).toThrow();
  expect(() => p75([])).toThrow();
});
