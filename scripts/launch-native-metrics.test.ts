import { createHash } from 'node:crypto';
import { beforeEach, expect, test, vi } from 'vitest';
import { checkLaunchNativeMetrics } from './launch-native-metrics';

const { files } = vi.hoisted(() => ({ files: new Map<string, Buffer>() }));
vi.mock('node:fs/promises', () => ({
  readFile: async (path: string, encoding?: string) => {
    const bytes = files.get(path);
    if (!bytes) throw new Error(`Missing fixture: ${path}`);
    return encoding ? bytes.toString(encoding as BufferEncoding) : bytes;
  },
}));
const sourceHash = 'native-budget-fixture';
const video = Buffer.from('synthetic video bytes for receipt contract tests');
function fixture() {
  return {
    engine: {
      hermes: true,
      passed: true,
      rows: ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic', 'daily'].flatMap(
        (system) => ['zh', 'en'].map((locale) => ({ system, locale, maxMs: 200, passed: true })),
      ),
    },
    movie: {
      sourceHash,
      recordingSha256: createHash('sha256').update(video).digest('hex'),
      engineMaxMs: 200,
      recordingDurationSeconds: 106,
      recordingStartedAfterEngine: true,
      configuration: 'Release',
    },
    cold: {
      sourceHash,
      configuration: 'Release',
      metro: false,
      passed: true,
      budgetMs: 2000,
      maxMs: 1500,
      samples: Array.from({ length: 5 }, () => ({ hermes: true, launchToReadyMs: 1500 })),
    },
    cadence: {
      sourceHash,
      configuration: 'Release',
      observer: 'none',
      passed: true,
      starfieldBudgetFps: 55,
      listBudgetFps: 55,
      listP95BudgetMs: 20,
      listMaxFrameBudgetMs: 50,
      longFrameThresholdMs: 25,
      samples: ['starfield', 'history'].flatMap((scene) =>
        [1, 2, 3].map((run) => ({
          scene,
          run,
          hermes: true,
          reduced: false,
          screenReader: false,
          fps: 60,
          p95Ms: 1000 / 60,
          maxMs: 1000 / 60,
          longFrames: 0,
          frames: 600,
          durationMs: 10000,
        })),
      ),
    },
  };
}
type Evidence = ReturnType<typeof fixture>;
function install(evidence: Evidence) {
  const root = 'apps/mobile/test-results/';
  for (const [file, value] of Object.entries({
    'M02/M02-engine.json': evidence.engine,
    'M02/run-metadata.json': evidence.movie,
    'M14/cold-start.json': evidence.cold,
    'M14/performance.json': evidence.cadence,
  }))
    files.set(root + file, Buffer.from(JSON.stringify(value)));
  for (const [name, target] of Object.entries({
    starfield: 55,
    sphere: 45,
    particles: 60,
    tarot: 60,
    coins: 60,
    wheel: 60,
  }))
    files.set(
      `${root}M02/M02-${name}.json`,
      Buffer.from(
        JSON.stringify({
          name,
          target,
          active: true,
          passed: true,
          fps: 60,
          frames: 600,
          durationMs: 10000,
        }),
      ),
    );
  files.set(root + 'M02/effects.mp4', video);
}
beforeEach(() => files.clear());
test('accepts a complete source-bound native measurement receipt', async () => {
  install(fixture());
  await expect(checkLaunchNativeMetrics(sourceHash)).resolves.toBeUndefined();
});
test('retains an occasional missed list deadline without mistaking it for a visible stall', async () => {
  const evidence = fixture();
  const list = evidence.cadence.samples.find((sample) => sample.scene === 'history')!;
  list.longFrames = 1;
  list.maxMs = 1000 / 30;
  list.frames = 599;
  list.fps = 59.9;
  install(evidence);
  await expect(checkLaunchNativeMetrics(sourceHash)).resolves.toBeUndefined();
});
test.each([
  {
    name: 'engine over budget',
    corrupt: (e: Evidence) => {
      e.engine.rows[0]!.maxMs = 301;
    },
  },
  {
    name: 'cold start over budget',
    corrupt: (e: Evidence) => {
      e.cold.samples[0]!.launchToReadyMs = 2001;
    },
  },
  {
    name: 'starfield below budget',
    corrupt: (e: Evidence) => {
      e.cadence.samples[0]!.fps = 54.9;
    },
  },
  {
    name: 'history visible stall',
    corrupt: (e: Evidence) => {
      e.cadence.samples.find((sample) => sample.scene === 'history')!.maxMs = 51;
    },
  },
  {
    name: 'history below cadence budget',
    corrupt: (e: Evidence) => {
      const list = e.cadence.samples.find((sample) => sample.scene === 'history')!;
      list.fps = 54.9;
      list.frames = 549;
    },
  },
  {
    name: 'history slow percentile',
    corrupt: (e: Evidence) => {
      e.cadence.samples.find((sample) => sample.scene === 'history')!.p95Ms = 20.1;
    },
  },
  {
    name: 'duplicate scene window',
    corrupt: (e: Evidence) => {
      e.cadence.samples[0]!.run = 2;
    },
  },
  {
    name: 'stale source',
    corrupt: (e: Evidence) => {
      e.movie.sourceHash = 'old-source';
    },
  },
  {
    name: 'changed recording',
    corrupt: (e: Evidence) => {
      e.movie.recordingSha256 = 'old-video';
    },
  },
])('rejects $name even when passed flags remain true', async ({ corrupt }) => {
  const evidence = fixture();
  corrupt(evidence);
  install(evidence);
  await expect(checkLaunchNativeMetrics(sourceHash)).rejects.toThrow();
});
