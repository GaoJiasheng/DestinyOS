import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const root = 'apps/mobile/test-results';
const finite = z.number().finite().nonnegative();
async function json(file: string): Promise<unknown> {
  return JSON.parse(await readFile(`${root}/${file}`, 'utf8')) as unknown;
}
/** Verify actual native measurements independently of screenshot/flow success flags. */
export async function checkLaunchNativeMetrics(sourceHash: string): Promise<void> {
  // DESIGN-GAP: Bind native measurement files and the delivery video to current source;
  // independently recalculate thresholds so historical screenshots cannot imply performance.
  const engine = z
    .object({
      hermes: z.literal(true),
      passed: z.literal(true),
      rows: z
        .array(
          z.object({
            system: z.string(),
            locale: z.enum(['zh', 'en']),
            maxMs: finite.max(300),
            passed: z.literal(true),
          }),
        )
        .length(16),
    })
    .parse(await json('M02/M02-engine.json'));
  assert.deepEqual(
    engine.rows.map((row) => `${row.system}/${row.locale}`).sort(),
    ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic', 'daily']
      .flatMap((system) => ['zh', 'en'].map((locale) => `${system}/${locale}`))
      .sort(),
  );
  const movie = z
    .object({
      sourceHash: z.literal(sourceHash),
      recordingSha256: z.string(),
      engineMaxMs: finite.max(300),
      recordingDurationSeconds: finite.min(60),
      recordingStartedAfterEngine: z.literal(true),
      configuration: z.literal('Release'),
    })
    .parse(await json('M02/run-metadata.json'));
  assert.equal(movie.engineMaxMs, Math.max(...engine.rows.map((row) => row.maxMs)));
  assert.equal(
    createHash('sha256')
      .update(await readFile(`${root}/M02/effects.mp4`))
      .digest('hex'),
    movie.recordingSha256,
  );
  const budgets = { starfield: 55, sphere: 45, particles: 60, tarot: 60, coins: 60, wheel: 60 };
  for (const [name, budget] of Object.entries(budgets)) {
    const frame = z
      .object({
        name: z.literal(name),
        active: z.literal(true),
        passed: z.literal(true),
        target: z.literal(budget),
        fps: finite,
        frames: finite.positive(),
        durationMs: finite.min(9900),
      })
      .parse(await json(`M02/M02-${name}.json`));
    assert.ok(frame.fps + 1e-6 >= budget, `${name}: ${frame.fps} < ${budget}`);
  }
  const cold = z
    .object({
      sourceHash: z.literal(sourceHash),
      configuration: z.literal('Release'),
      metro: z.literal(false),
      passed: z.literal(true),
      budgetMs: z.literal(2000),
      maxMs: finite.max(2000),
      samples: z
        .array(z.object({ hermes: z.literal(true), launchToReadyMs: finite.max(2000) }))
        .length(5),
    })
    .parse(await json('M14/cold-start.json'));
  assert.equal(cold.maxMs, Math.max(...cold.samples.map((sample) => sample.launchToReadyMs)));
  const cadence = z
    .object({
      sourceHash: z.literal(sourceHash),
      configuration: z.literal('Release'),
      observer: z.literal('none'),
      passed: z.literal(true),
      starfieldBudgetFps: z.literal(55),
      listBudgetFps: z.literal(55),
      listP95BudgetMs: z.literal(20),
      listMaxFrameBudgetMs: z.literal(50),
      longFrameThresholdMs: z.literal(25),
      samples: z
        .array(
          z.object({
            scene: z.enum(['starfield', 'history']),
            run: z.number().int().min(1).max(3),
            hermes: z.literal(true),
            reduced: z.literal(false),
            screenReader: z.literal(false),
            fps: finite,
            p95Ms: finite.nonnegative(),
            maxMs: finite.nonnegative(),
            longFrames: finite.int().nonnegative(),
            frames: finite.positive(),
            durationMs: finite.min(9900),
          }),
        )
        .length(6),
    })
    .parse(await json('M14/performance.json'));
  assert.deepEqual(
    cadence.samples.map((sample) => `${sample.scene}/${sample.run}`).sort(),
    ['starfield', 'history'].flatMap((scene) => [1, 2, 3].map((run) => `${scene}/${run}`)).sort(),
  );
  // DESIGN-GAP: Keep M14's prescribed 55fps/2s gates; list acceptance uses explicit
  // cadence/tail-latency limits instead of incorrectly requiring zero 25ms intervals.
  for (const sample of cadence.samples) {
    assert.ok(sample.fps >= 55);
    assert.ok(Math.abs(sample.fps - (sample.frames * 1000) / sample.durationMs) < 1e-6);
    assert.ok(sample.longFrames <= sample.frames);
    if (sample.scene === 'history') assert.ok(sample.p95Ms <= 20 && sample.maxMs <= 50);
  }
}
