import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { z } from 'zod';
import { launchNativeSourceHash } from './launch-source-hash';
import { checkNativeScreenshot } from './launch-screenshots';
import { checkLaunchNativeMetrics } from './launch-native-metrics';

/** Verify all current Maestro flows and published baseline hashes for native acceptance. */
export async function checkLaunchApp(): Promise<string> {
  // DESIGN-GAP: Archive the successful receipt with committed baselines so a clean checkout
  // can verify launch evidence; local reruns take precedence and retain their own timestamp.
  const receipt = await readFile('apps/mobile/test-results/launch/results.json', 'utf8').catch(() =>
    readFile('apps/mobile/test-results/M15/launch-verification.json', 'utf8'),
  );
  const evidence = z
    .object({
      complete: z.boolean(),
      sourceHash: z.string(),
      checkedAt: z.string().datetime(),
      results: z.array(
        z.object({
          flow: z.string(),
          passed: z.boolean(),
          flowHash: z.string(),
          screenshots: z.array(z.object({ file: z.string(), sha256: z.string() })).min(1),
        }),
      ),
    })
    .parse(JSON.parse(receipt));
  assert.ok(evidence.complete, 'Native run is incomplete');
  assert.equal(
    evidence.sourceHash,
    await launchNativeSourceHash(),
    'Native runtime/corpus/catalog evidence is stale',
  );
  const flows = (await readdir('apps/mobile/maestro')).filter((name) => name.endsWith('.yaml'));
  assert.deepEqual(evidence.results.map((result) => `${result.flow}.yaml`).sort(), flows.sort());
  let screenshots = 0;
  for (const result of evidence.results) {
    assert.ok(result.passed, `${result.flow} failed`);
    assert.equal(
      createHash('sha256')
        .update(await readFile(`apps/mobile/maestro/${result.flow}.yaml`))
        .digest('hex'),
      result.flowHash,
      `Stale ${result.flow} flow`,
    );
    for (const screenshot of result.screenshots) {
      assert.ok(screenshot.file.startsWith('test-results/') && !screenshot.file.includes('..'));
      await checkNativeScreenshot(
        await readFile(`apps/mobile/${screenshot.file}`),
        screenshot.file,
      );
      assert.equal(
        createHash('sha256')
          .update(await readFile(`apps/mobile/${screenshot.file}`))
          .digest('hex'),
        screenshot.sha256,
        `Stale screenshot ${screenshot.file}`,
      );
      screenshots++;
    }
  }
  // DESIGN-GAP: Native Skia exports are original cache PNGs, distinct from device
  // screenshots; bind their supplemental capture receipt to the current flow/runtime.
  const rendered = z
    .object({
      sourceHash: z.string(),
      artifacts: z
        .array(
          z.object({
            file: z.string(),
            flow: z.string(),
            flowHash: z.string(),
            sha256: z.string(),
            capturedAt: z.string().datetime(),
          }),
        )
        .length(4),
    })
    .parse(
      JSON.parse(await readFile('apps/mobile/test-results/M15/rendered-artifacts.json', 'utf8')),
    );
  assert.equal(rendered.sourceHash, evidence.sourceHash);
  assert.deepEqual(rendered.artifacts.map((artifact) => artifact.file).sort(), [
    'test-results/M08/share-card-en.png',
    'test-results/M08/share-card-zh.png',
    'test-results/M12/poster-landscape-zh.png',
    'test-results/M12/poster-portrait-en.png',
  ]);
  for (const artifact of rendered.artifacts) {
    assert.equal(
      artifact.flowHash,
      evidence.results.find((result) => result.flow === artifact.flow)?.flowHash,
    );
    assert.equal(
      createHash('sha256')
        .update(await readFile(`apps/mobile/${artifact.file}`))
        .digest('hex'),
      artifact.sha256,
    );
  }
  await checkLaunchNativeMetrics(evidence.sourceHash);
  return `${flows.length} current iOS Maestro flows passed; ${screenshots} screenshots and 4 original render hashes verified; native compute/frame/cold-start budgets passed; checked ${evidence.checkedAt}`;
}
