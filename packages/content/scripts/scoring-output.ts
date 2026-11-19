import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { toTraditional } from '../../../scripts/traditional-converter';
import type { CompiledScoringCopy, ScoringLocaleCopy } from '../src';
import type { CompiledScoring } from './scoring';
import type { Diagnostic } from './validation';
import { root } from './load';
// DESIGN-GAP: Compiled scoring data is committed under src (dist is gitignored and typecheck runs
// before content:build in CI); validate fails when these files drift from ziwei/scoring.yaml.
export const scoringOutputs = {
  rules: join(root, 'src/scoring/ziwei-rules.json'),
  copy: join(root, 'src/scoring/ziwei-copy.json'),
};
/** Convert every zh string with the repository OpenCC pipeline; keys and placeholders stay intact. */
function traditional(copy: ScoringLocaleCopy): ScoringLocaleCopy {
  return JSON.parse(
    JSON.stringify(copy, (_key, value: unknown) =>
      typeof value === 'string' ? toTraditional(value) : value,
    ),
  ) as ScoringLocaleCopy;
}
/** Serialize both generated files exactly as prettier would, so lint and the freshness check agree. */
export async function renderScoring(
  compiled: CompiledScoring,
): Promise<Record<keyof typeof scoringOutputs, string>> {
  const copy: CompiledScoringCopy = {
    ...compiled.copy,
    locales: { ...compiled.copy.locales, 'zh-TW': traditional(compiled.copy.locales.zh) },
  };
  const options = { ...(await resolveConfig(scoringOutputs.rules)), parser: 'json' };
  return {
    rules: await format(JSON.stringify(compiled.rules), options),
    copy: await format(JSON.stringify(copy), options),
  };
}
/** Write generated scoring files during content:build. */
export async function writeScoring(compiled: CompiledScoring) {
  const rendered = await renderScoring(compiled);
  for (const key of Object.keys(scoringOutputs) as (keyof typeof scoringOutputs)[])
    await writeFile(scoringOutputs[key], rendered[key]);
}
/** Report generated scoring files that no longer match the source table. */
export async function checkScoringOutputs(compiled: CompiledScoring): Promise<Diagnostic[]> {
  const rendered = await renderScoring(compiled);
  const diagnostics: Diagnostic[] = [];
  for (const key of Object.keys(scoringOutputs) as (keyof typeof scoringOutputs)[]) {
    const current = await readFile(scoringOutputs[key], 'utf8').catch(() => '');
    if (current !== rendered[key])
      diagnostics.push({
        file: scoringOutputs[key],
        line: 1,
        column: 1,
        severity: 'error',
        message: 'Generated scoring data is stale; run pnpm --filter @tianji/content content:build',
      });
  }
  return diagnostics;
}
