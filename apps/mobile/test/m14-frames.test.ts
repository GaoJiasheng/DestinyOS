import { frameStalls, summarizeFrames } from '../lib/diagnostics/frame-metrics';
it('detects a scroll stall even when average cadence passes the 55fps budget', () => {
  const intervals = [...Array<number>(600).fill(1000 / 60), 100];
  expect(summarizeFrames(intervals, 'ui-display').fps).toBeGreaterThan(55);
  expect(frameStalls(intervals)).toEqual({ longFrames: 1, maxMs: 100 });
});
